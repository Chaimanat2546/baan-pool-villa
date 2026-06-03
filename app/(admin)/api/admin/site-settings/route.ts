import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { SITE_ASSETS_BUCKET, SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type {
  SitePhoneContact,
  SiteAssetType,
  SiteAssetUploadRecord,
  SiteSettingsRow,
} from "@/lib/site-settings/types";
import {
  normalizeSiteSettingsDraft,
  normalizeSiteSettingsRow,
  selectAssetUploadsForCleanup,
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls";
const SITE_ASSET_UPLOADS_SELECT =
  "id,asset_type,storage_bucket,storage_path,is_current,created_at";
const ASSET_UPLOAD_FIELDS: { assetType: SiteAssetType; fieldName: string }[] = [
  { assetType: "logo", fieldName: "logo" },
  { assetType: "hero", fieldName: "hero" },
];

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface UploadedAsset {
  assetType: SiteAssetType;
  path: string;
  publicUrl: string;
}

interface RecordedAsset extends UploadedAsset {
  uploadId: string;
}

interface SiteAssetUploadRow {
  id: unknown;
  asset_type: unknown;
  storage_bucket: unknown;
  storage_path: unknown;
  is_current: unknown;
  created_at: unknown;
}

type AdminCheck = Awaited<ReturnType<typeof assertHomeConfigAdmin>>;
type HomeConfigSupabaseClient = Extract<AdminCheck, { ok: true }>["supabase"];

function supabaseErrorResponse(
  error: SupabaseLikeError | null | undefined,
  fallbackMessage: string,
  warning?: string,
) {
  return jsonError(error?.message ?? fallbackMessage, 403, {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    warning,
  });
}

async function requireAdmin(request: Request): Promise<
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false, response: jsonError("Missing bearer token.", 401) };
  }

  const adminCheck = await assertHomeConfigAdmin(token);

  if (!adminCheck.ok) {
    return {
      ok: false,
      response: jsonError(adminCheck.message, adminCheck.status),
    };
  }

  return { ok: true, supabase: adminCheck.supabase };
}

function readStringField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

function readPhoneContactsField(formData: FormData): SitePhoneContact[] {
  const rawValue = readStringField(formData, "phoneContacts");

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((item) => {
      if (!item || typeof item !== "object") {
        return { name: "", phone: "", time: "" };
      }

      const contact = item as Partial<Record<keyof SitePhoneContact, unknown>>;

      return {
        name: typeof contact.name === "string" ? contact.name : "",
        phone: typeof contact.phone === "string" ? contact.phone : "",
        time: typeof contact.time === "string" ? contact.time : "",
      };
    });
  } catch {
    return [];
  }
}

function readStringArrayField(formData: FormData, fieldName: string): string[] {
  const rawValue = readStringField(formData, fieldName);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((item) => (typeof item === "string" ? item : ""));
  } catch {
    return rawValue
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n")
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

function getOptionalUpload(formData: FormData, fieldName: string): File | null {
  const value = formData.get(fieldName);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function getUploadExtension(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function buildStoragePath(assetType: SiteAssetType, mimeType: string): string {
  const extension = getUploadExtension(mimeType);

  if (!extension) {
    throw new Error("Unsupported upload MIME type");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${assetType}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function removeUploadedAssets(
  supabase: HomeConfigSupabaseClient,
  uploadedAssets: UploadedAsset[],
): Promise<string[]> {
  if (uploadedAssets.length === 0) {
    return [];
  }

  const paths = uploadedAssets.map((asset) => asset.path);
  const { error } = await supabase.storage.from(SITE_ASSETS_BUCKET).remove(paths);

  return error ? [`Unable to clean up uploaded assets: ${error.message}`] : [];
}

async function deleteRecordedAssets(
  supabase: HomeConfigSupabaseClient,
  recordedAssets: RecordedAsset[],
): Promise<string[]> {
  const warnings: string[] = [];

  for (const asset of recordedAssets) {
    const { error } = await supabase
      .from("site_asset_uploads")
      .delete()
      .eq("id", asset.uploadId);

    if (error) {
      warnings.push(
        `Unable to remove ${asset.assetType} upload history after failure: ${error.message}`,
      );
    }
  }

  return warnings;
}

async function uploadAsset(
  supabase: HomeConfigSupabaseClient,
  assetType: SiteAssetType,
  file: File,
): Promise<{ asset: UploadedAsset | null; error: SupabaseLikeError | null }> {
  const path = buildStoragePath(assetType, file.type);
  const { error } = await supabase.storage.from(SITE_ASSETS_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { asset: null, error };
  }

  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path);

  return {
    asset: {
      assetType,
      path,
      publicUrl: data.publicUrl,
    },
    error: null,
  };
}

function mapUploadRow(row: SiteAssetUploadRow): SiteAssetUploadRecord | null {
  if (
    (row.asset_type !== "logo" && row.asset_type !== "hero") ||
    typeof row.created_at !== "string" ||
    typeof row.id !== "string" ||
    typeof row.is_current !== "boolean" ||
    typeof row.storage_bucket !== "string" ||
    typeof row.storage_path !== "string"
  ) {
    return null;
  }

  return {
    assetType: row.asset_type,
    createdAt: row.created_at,
    id: row.id,
    isCurrent: row.is_current,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
  };
}

async function recordUploadedAssets(
  supabase: HomeConfigSupabaseClient,
  uploadedAssets: UploadedAsset[],
): Promise<
  | {
      ok: true;
      recordedAssets: RecordedAsset[];
    }
  | {
      ok: false;
      error: SupabaseLikeError;
      recordedAssets: RecordedAsset[];
    }
> {
  const recordedAssets: RecordedAsset[] = [];

  for (const asset of uploadedAssets) {
    const { data, error } = await supabase
      .from("site_asset_uploads")
      .insert({
        asset_type: asset.assetType,
        storage_bucket: SITE_ASSETS_BUCKET,
        storage_path: asset.path,
        public_url: asset.publicUrl,
        is_current: true,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error, recordedAssets };
    }

    if (!data || typeof data.id !== "string") {
      return {
        ok: false,
        error: { message: `Unable to read ${asset.assetType} upload history id.` },
        recordedAssets,
      };
    }

    recordedAssets.push({ ...asset, uploadId: data.id });
  }

  return { ok: true, recordedAssets };
}

async function markPreviousUploadsInactive(
  supabase: HomeConfigSupabaseClient,
  recordedAssets: RecordedAsset[],
): Promise<SupabaseLikeError | null> {
  for (const asset of recordedAssets) {
    const { error } = await supabase
      .from("site_asset_uploads")
      .update({ is_current: false })
      .eq("asset_type", asset.assetType)
      .eq("storage_bucket", SITE_ASSETS_BUCKET)
      .eq("is_current", true)
      .neq("id", asset.uploadId);

    if (error) {
      return error;
    }
  }

  return null;
}

function hasValidCleanupPath(record: SiteAssetUploadRecord): boolean {
  return (
    record.storageBucket === SITE_ASSETS_BUCKET &&
    record.storagePath.startsWith(`${record.assetType}/`)
  );
}

async function cleanupRetainedAssets(
  supabase: HomeConfigSupabaseClient,
): Promise<string[]> {
  const warnings: string[] = [];
  const { data, error } = await supabase
    .from("site_asset_uploads")
    .select(SITE_ASSET_UPLOADS_SELECT)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return [error?.message ?? "Unable to load site asset upload history."];
  }

  const records: SiteAssetUploadRecord[] = [];

  (data as SiteAssetUploadRow[]).forEach((row) => {
    const record = mapUploadRow(row);

    if (!record) {
      warnings.push("Skipped invalid site asset upload history row during cleanup.");
      return;
    }

    if (!hasValidCleanupPath(record)) {
      warnings.push(
        `Skipped cleanup for ${record.assetType} upload with unexpected storage location.`,
      );
      return;
    }

    records.push(record);
  });

  const cleanupRecords = selectAssetUploadsForCleanup(records);

  for (const record of cleanupRecords) {
    const { error: removeError } = await supabase.storage
      .from(record.storageBucket)
      .remove([record.storagePath]);

    if (removeError) {
      warnings.push(`Unable to remove old ${record.assetType} asset: ${removeError.message}`);
      continue;
    }

    const { error: deleteError } = await supabase
      .from("site_asset_uploads")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      warnings.push(
        `Unable to delete old ${record.assetType} upload history: ${deleteError.message}`,
      );
    }
  }

  return warnings;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await admin.supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return supabaseErrorResponse(error, "Unable to load site settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null),
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: ["Request body must be multipart/form-data."] }, { status: 400 });
  }

  const draft = normalizeSiteSettingsDraft({
    siteName: readStringField(formData, "siteName"),
    primaryColor: readStringField(formData, "primaryColor"),
    accentColor: readStringField(formData, "accentColor"),
    heroImageAlt: readStringField(formData, "heroImageAlt"),
    bankAccountName: readStringField(formData, "bankAccountName"),
    bankName: readStringField(formData, "bankName"),
    bankAccountNumber: readStringField(formData, "bankAccountNumber"),
    phoneContacts: readPhoneContactsField(formData),
    messengerUrl: readStringField(formData, "messengerUrl"),
    lineId: readStringField(formData, "lineId"),
    lineUrl: readStringField(formData, "lineUrl"),
    seoTitle: readStringField(formData, "seoTitle"),
    seoDescription: readStringField(formData, "seoDescription"),
    seoOgImageUrl: readStringField(formData, "seoOgImageUrl"),
    seoOgImageAlt: readStringField(formData, "seoOgImageAlt"),
    seoBusinessName: readStringField(formData, "seoBusinessName"),
    seoSameAsUrls: readStringArrayField(formData, "seoSameAsUrls"),
  });
  const errors = validateSiteSettingsDraft(draft);
  const uploadFiles: { assetType: SiteAssetType; file: File }[] = [];

  ASSET_UPLOAD_FIELDS.forEach(({ assetType, fieldName }) => {
    const file = getOptionalUpload(formData, fieldName);

    if (!file) {
      return;
    }

    errors.push(...validateUploadMetadata(assetType, file.type, file.size));
    uploadFiles.push({ assetType, file });
  });

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const { data: existingRow, error: loadError } = await admin.supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (loadError) {
    return supabaseErrorResponse(loadError, "Unable to load site settings.");
  }

  const currentSettings = normalizeSiteSettingsRow(
    (existingRow as SiteSettingsRow | null) ?? null,
  );
  const uploadedAssets: UploadedAsset[] = [];

  for (const upload of uploadFiles) {
    const result = await uploadAsset(admin.supabase, upload.assetType, upload.file);

    if (result.error || !result.asset) {
      const cleanupWarnings = await removeUploadedAssets(admin.supabase, uploadedAssets);

      return supabaseErrorResponse(
        result.error,
        `Unable to upload ${upload.assetType} image.`,
        cleanupWarnings.join("; ") || undefined,
      );
    }

    uploadedAssets.push(result.asset);
  }

  const logoUpload = uploadedAssets.find((asset) => asset.assetType === "logo");
  const heroUpload = uploadedAssets.find((asset) => asset.assetType === "hero");
  const historyResult = await recordUploadedAssets(admin.supabase, uploadedAssets);

  if (!historyResult.ok) {
    const cleanupWarnings = [
      ...(await deleteRecordedAssets(admin.supabase, historyResult.recordedAssets)),
      ...(await removeUploadedAssets(admin.supabase, uploadedAssets)),
    ];

    return supabaseErrorResponse(
      historyResult.error,
      "Unable to record site asset upload history.",
      cleanupWarnings.join("; ") || undefined,
    );
  }

  const savePayload = {
    id: SITE_SETTINGS_ID,
    site_name: draft.siteName,
    primary_color: draft.primaryColor,
    accent_color: draft.accentColor,
    logo_image_path: logoUpload?.path ?? currentSettings.logoImage.path,
    logo_image_url: logoUpload?.publicUrl ?? currentSettings.logoImage.url,
    hero_image_path: heroUpload?.path ?? currentSettings.heroImage.path,
    hero_image_url: heroUpload?.publicUrl ?? currentSettings.heroImage.url,
    hero_image_alt: draft.heroImageAlt,
    bank_account_name: draft.bankAccountName,
    bank_name: draft.bankName,
    bank_account_number: draft.bankAccountNumber,
    phone_contacts: draft.phoneContacts,
    messenger_url: draft.messengerUrl,
    line_id: draft.lineId,
    line_url: draft.lineUrl,
    seo_title: draft.seoTitle,
    seo_description: draft.seoDescription,
    seo_og_image_url: draft.seoOgImageUrl,
    seo_og_image_alt: draft.seoOgImageAlt,
    seo_business_name: draft.seoBusinessName,
    seo_same_as_urls: draft.seoSameAsUrls,
  };

  const { data, error: saveError } = await admin.supabase
    .from("site_settings")
    .upsert(savePayload, { onConflict: "id" })
    .select(SITE_SETTINGS_SELECT)
    .single();

  if (saveError) {
    const cleanupWarnings = [
      ...(await deleteRecordedAssets(admin.supabase, historyResult.recordedAssets)),
      ...(await removeUploadedAssets(admin.supabase, uploadedAssets)),
    ];

    return supabaseErrorResponse(
      saveError,
      "Unable to save site settings.",
      cleanupWarnings.join("; ") || undefined,
    );
  }

  const historyUpdateError = await markPreviousUploadsInactive(
    admin.supabase,
    historyResult.recordedAssets,
  );

  if (historyUpdateError) {
    return supabaseErrorResponse(
      historyUpdateError,
      "Unable to mark previous site asset uploads inactive.",
    );
  }

  const warnings = [
    ...(uploadedAssets.length > 0
      ? await cleanupRetainedAssets(admin.supabase)
      : []),
  ];

  revalidateSiteSettingsCache();

  return Response.json({
    settings: normalizeSiteSettingsRow(data as SiteSettingsRow),
    warnings,
  });
}
