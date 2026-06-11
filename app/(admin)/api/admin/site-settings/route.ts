import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
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
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_og_image_url,guides_seo_og_image_alt,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_TIKTOK =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout";
const SITE_SETTINGS_GENERAL_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls";
const SITE_ASSET_UPLOADS_SELECT =
  "id,asset_type,storage_bucket,storage_path,is_current,created_at";
const ASSET_UPLOAD_FIELDS: { assetType: SiteAssetType; fieldName: string }[] = [
  { assetType: "logo", fieldName: "logo" },
  { assetType: "hero", fieldName: "hero" },
];

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

/**
 * Determines whether a Supabase-style error likely indicates a missing column or schema cache issue.
 *
 * @param error - The Supabase-like error object to inspect, or `null`/`undefined`.
 * @returns `true` if the error appears to be caused by a missing column or schema-cache/schema-mismatch problem, `false` otherwise.
 */
function isMissingColumnError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("schema cache") ||
    message.includes("unknown column")
  );
}

/**
 * Load the admin-visible site settings row, falling back to reduced column sets if the database schema is missing recently added columns.
 *
 * Attempts to select the full `SITE_SETTINGS_SELECT` projection by the fixed site settings ID; if that query fails with an error that appears to indicate a missing column or schema cache issue, retries with projections that omit optional feature columns.
 *
 * @returns An object with `data` set to the found site settings row or `null` when not found, and `error` set to a Supabase-like error object when retrieval failed or `null` on success.
 */
async function loadAdminSiteSettings(
  supabase: HomeConfigSupabaseClient,
): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
}> {
  const primary = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!primary.error) {
    return {
      data: (primary.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(primary.error)) {
    return { data: null, error: primary.error };
  }

  const fallbackWithoutKeywords = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallbackWithoutKeywords.error) {
    return {
      data: (fallbackWithoutKeywords.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallbackWithoutKeywords.error)) {
    return { data: null, error: fallbackWithoutKeywords.error };
  }

  const fallbackWithoutPageSeo = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallbackWithoutPageSeo.error) {
    return {
      data: (fallbackWithoutPageSeo.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallbackWithoutPageSeo.error)) {
    return { data: null, error: fallbackWithoutPageSeo.error };
  }

  const fallback = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_TIKTOK)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallback.error) {
    return {
      data: (fallback.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallback.error)) {
    return { data: null, error: fallback.error };
  }

  const general = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_GENERAL_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!general.error) {
    return {
      data: (general.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  return { data: null, error: general.error };
}

/**
 * Produce a SiteSettingsRow by merging saved values into an existing row, with saved values taking precedence.
 *
 * @param existingRow - The current persisted settings row, or `null` if none exists
 * @param savePayload - Partial settings values to apply on top of `existingRow`
 * @returns A `SiteSettingsRow` representing the merged result
 */
function buildSavedSettingsRow(
  existingRow: SiteSettingsRow | null,
  savePayload: Record<string, unknown>,
): SiteSettingsRow {
  return {
    ...(existingRow ?? {}),
    ...savePayload,
  } as SiteSettingsRow;
}

function isAllowedAdminMutationOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function readStringField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

type PhoneContactsFieldResult =
  | {
      ok: true;
      value: SitePhoneContact[];
    }
  | {
      ok: false;
      error: string;
    };

function readPhoneContactsField(formData: FormData): PhoneContactsFieldResult {
  const rawValue = readStringField(formData, "phoneContacts");

  if (!rawValue) {
    return { ok: true, value: [] };
  }

  const invalidPhoneContactsError = "ข้อมูลเบอร์โทรติดต่อไม่ถูกต้อง";

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return { ok: false, error: invalidPhoneContactsError };
    }

    const phoneContacts: SitePhoneContact[] = [];

    for (const item of parsedValue) {
      if (!item || typeof item !== "object") {
        return { ok: false, error: invalidPhoneContactsError };
      }

      const contact = item as Partial<Record<keyof SitePhoneContact, unknown>>;

      if (
        typeof contact.name !== "string" ||
        typeof contact.phone !== "string" ||
        typeof contact.time !== "string"
      ) {
        return { ok: false, error: invalidPhoneContactsError };
      }

      phoneContacts.push({
        name: contact.name,
        phone: contact.phone,
        time: contact.time,
      });
    }

    return { ok: true, value: phoneContacts };
  } catch {
    return { ok: false, error: invalidPhoneContactsError };
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
    return splitDelimitedString(rawValue);
  }
}

function splitDelimitedString(value: string): string[] {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", ",")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

/**
 * Handle GET requests to return the current admin-visible site settings.
 *
 * Performs admin authorization and, if authorized, returns a JSON response
 * containing the normalized site settings. On authorization failure or data
 * loading errors, returns an appropriate JSON error response.
 *
 * @returns A Response whose body is JSON `{ settings: <normalized site settings or null> }` on success, or a JSON error response on failure.
 */
export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await loadAdminSiteSettings(admin.supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load site settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null),
  });
}

/**
 * Handle an admin-authenticated multipart PUT request to validate and persist site settings, optionally upload logo and hero images, record upload history, clean up retained assets, and revalidate the site settings cache.
 *
 * @returns On success, an object with `settings` containing the saved site settings and `warnings` as an array of cleanup warnings (may be empty). On failure, an error response describing authorization, validation, upload, or persistence failures.
 */
export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  if (!isAllowedAdminMutationOrigin(request)) {
    return Response.json(
      { errors: ["Admin request origin is not allowed."] },
      { status: 403 },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: ["Request body must be multipart/form-data."] }, { status: 400 });
  }

  const phoneContactsResult = readPhoneContactsField(formData);

  if (!phoneContactsResult.ok) {
    return Response.json({ errors: [phoneContactsResult.error] }, { status: 400 });
  }

  const draft = normalizeSiteSettingsDraft({
    siteName: readStringField(formData, "siteName"),
    primaryColor: readStringField(formData, "primaryColor"),
    accentColor: readStringField(formData, "accentColor"),
    heroImageAlt: readStringField(formData, "heroImageAlt"),
    bankAccountName: readStringField(formData, "bankAccountName"),
    bankName: readStringField(formData, "bankName"),
    bankAccountNumber: readStringField(formData, "bankAccountNumber"),
    phoneContacts: phoneContactsResult.value,
    messengerUrl: readStringField(formData, "messengerUrl"),
    lineId: readStringField(formData, "lineId"),
    lineUrl: readStringField(formData, "lineUrl"),
    seoTitle: readStringField(formData, "seoTitle"),
    seoDescription: readStringField(formData, "seoDescription"),
    seoKeywords: readStringArrayField(formData, "seoKeywords"),
    seoOgImageUrl: readStringField(formData, "seoOgImageUrl"),
    seoOgImageAlt: readStringField(formData, "seoOgImageAlt"),
    seoBusinessName: readStringField(formData, "seoBusinessName"),
    seoSameAsUrls: readStringArrayField(formData, "seoSameAsUrls"),
    searchSeoTitle: readStringField(formData, "searchSeoTitle"),
    searchSeoDescription: readStringField(formData, "searchSeoDescription"),
    searchSeoKeywords: readStringArrayField(formData, "searchSeoKeywords"),
    searchSeoOgImageUrl: readStringField(formData, "searchSeoOgImageUrl"),
    searchSeoOgImageAlt: readStringField(formData, "searchSeoOgImageAlt"),
    guidesSeoTitle: readStringField(formData, "guidesSeoTitle"),
    guidesSeoDescription: readStringField(formData, "guidesSeoDescription"),
    guidesSeoKeywords: readStringArrayField(formData, "guidesSeoKeywords"),
    guidesSeoOgImageUrl: readStringField(formData, "guidesSeoOgImageUrl"),
    guidesSeoOgImageAlt: readStringField(formData, "guidesSeoOgImageAlt"),
    villaDetailSeoKeywords: readStringArrayField(formData, "villaDetailSeoKeywords"),
    tiktokAccountUrl: "",
    tiktokVideoUrls: [],
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

  const { data: existingRow, error: loadError } = await loadAdminSiteSettings(
    admin.supabase,
  );

  if (loadError) {
    return adminSupabaseErrorResponse(loadError, "Unable to load site settings.");
  }

  const currentSettings = normalizeSiteSettingsRow(
    (existingRow as SiteSettingsRow | null) ?? null,
  );
  const uploadedAssets: UploadedAsset[] = [];

  for (const upload of uploadFiles) {
    const result = await uploadAsset(admin.supabase, upload.assetType, upload.file);

    if (result.error || !result.asset) {
      const cleanupWarnings = await removeUploadedAssets(admin.supabase, uploadedAssets);

      return adminSupabaseErrorResponse(
        result.error,
        `Unable to upload ${upload.assetType} image.`,
        { warning: cleanupWarnings.join("; ") || undefined },
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

    return adminSupabaseErrorResponse(
      historyResult.error,
      "Unable to record site asset upload history.",
      { warning: cleanupWarnings.join("; ") || undefined },
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
    seo_keywords: draft.seoKeywords,
    seo_og_image_url: draft.seoOgImageUrl,
    seo_og_image_alt: draft.seoOgImageAlt,
    seo_business_name: draft.seoBusinessName,
    seo_same_as_urls: draft.seoSameAsUrls,
    search_seo_title: draft.searchSeoTitle,
    search_seo_description: draft.searchSeoDescription,
    search_seo_keywords: draft.searchSeoKeywords,
    search_seo_og_image_url: draft.searchSeoOgImageUrl,
    search_seo_og_image_alt: draft.searchSeoOgImageAlt,
    guides_seo_title: draft.guidesSeoTitle,
    guides_seo_description: draft.guidesSeoDescription,
    guides_seo_keywords: draft.guidesSeoKeywords,
    guides_seo_og_image_url: draft.guidesSeoOgImageUrl,
    guides_seo_og_image_alt: draft.guidesSeoOgImageAlt,
    villa_detail_seo_keywords: draft.villaDetailSeoKeywords,
  };

  const { error: saveError } = await admin.supabase
    .from("site_settings")
    .upsert(savePayload, { onConflict: "id" });

  if (saveError) {
    const cleanupWarnings = [
      ...(await deleteRecordedAssets(admin.supabase, historyResult.recordedAssets)),
      ...(await removeUploadedAssets(admin.supabase, uploadedAssets)),
    ];

    return adminSupabaseErrorResponse(
      saveError,
      "Unable to save site settings.",
      { warning: cleanupWarnings.join("; ") || undefined },
    );
  }

  const historyUpdateError = await markPreviousUploadsInactive(
    admin.supabase,
    historyResult.recordedAssets,
  );

  if (historyUpdateError) {
    return adminSupabaseErrorResponse(
      historyUpdateError,
      "Unable to mark previous site asset uploads inactive.",
    );
  }

  const warnings = [
    ...(uploadedAssets.length > 0
      ? await cleanupRetainedAssets(admin.supabase)
      : []),
  ];
  const { data: savedRow, error: reloadError } = await loadAdminSiteSettings(
    admin.supabase,
  );
  const responseRow = reloadError
    ? buildSavedSettingsRow((existingRow as SiteSettingsRow | null) ?? null, savePayload)
    : ((savedRow as SiteSettingsRow | null) ??
      buildSavedSettingsRow((existingRow as SiteSettingsRow | null) ?? null, savePayload));

  if (reloadError) {
    warnings.push(reloadError.message ?? "Unable to reload saved site settings.");
  }

  revalidateSiteSettingsCache();

  return Response.json({
    settings: normalizeSiteSettingsRow(responseRow),
    warnings,
  });
}
