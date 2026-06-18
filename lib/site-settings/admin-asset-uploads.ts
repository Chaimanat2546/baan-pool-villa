import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";

import { SITE_ASSETS_BUCKET } from "./defaults";
import type { SiteAssetType, SiteAssetUploadRecord } from "./types";
import { selectAssetUploadsForCleanup } from "./validation";

export interface UploadedAsset {
  assetType: SiteAssetType;
  path: string;
  publicUrl: string;
}

export interface RecordedAsset extends UploadedAsset {
  uploadId: string;
}

interface UploadFile {
  assetType: SiteAssetType;
  file: File;
}

interface SiteAssetUploadRow {
  id: unknown;
  asset_type: unknown;
  storage_bucket: unknown;
  storage_path: unknown;
  is_current: unknown;
  created_at: unknown;
}

const SITE_ASSET_UPLOADS_SELECT =
  "id,asset_type,storage_bucket,storage_path,is_current,created_at";

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

export function buildSiteAssetStoragePath(
  assetType: SiteAssetType,
  mimeType: string,
): string {
  const extension = getUploadExtension(mimeType);

  if (!extension) {
    throw new Error("Unsupported upload MIME type");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${assetType}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export async function removeUploadedAssets(
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

export async function deleteRecordedAssets(
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

export async function cleanupFailedSiteAssetSave(
  supabase: HomeConfigSupabaseClient,
  recordedAssets: RecordedAsset[],
  uploadedAssets: UploadedAsset[],
): Promise<string[]> {
  return [
    ...(await deleteRecordedAssets(supabase, recordedAssets)),
    ...(await removeUploadedAssets(supabase, uploadedAssets)),
  ];
}

export async function uploadAsset(
  supabase: HomeConfigSupabaseClient,
  assetType: SiteAssetType,
  file: File,
): Promise<{ asset: UploadedAsset | null; error: SupabaseLikeError | null }> {
  let path: string;

  try {
    path = buildSiteAssetStoragePath(assetType, file.type);
  } catch (error) {
    return {
      asset: null,
      error: error instanceof Error ? error : new Error("Unable to upload asset"),
    };
  }

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

export async function uploadSiteSettingsAssets(
  supabase: HomeConfigSupabaseClient,
  uploadFiles: UploadFile[],
): Promise<
  | {
      ok: true;
      uploadedAssets: UploadedAsset[];
    }
  | {
      assetType: SiteAssetType;
      cleanupWarnings: string[];
      error: SupabaseLikeError | null;
      ok: false;
    }
> {
  const uploadedAssets: UploadedAsset[] = [];

  for (const upload of uploadFiles) {
    const result = await uploadAsset(supabase, upload.assetType, upload.file);

    if (result.error || !result.asset) {
      return {
        assetType: upload.assetType,
        cleanupWarnings: await removeUploadedAssets(supabase, uploadedAssets),
        error: result.error,
        ok: false,
      };
    }

    uploadedAssets.push(result.asset);
  }

  return { ok: true, uploadedAssets };
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

export async function recordUploadedAssets(
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

export async function markPreviousUploadsInactive(
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

export async function cleanupRetainedAssets(
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
