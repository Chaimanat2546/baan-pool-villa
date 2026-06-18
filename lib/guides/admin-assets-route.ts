import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { validateGuideUploadMetadata } from "@/lib/guides/validation";
import { GUIDE_ASSETS_BUCKET } from "./defaults";

export type GuideAssetRole = "cover" | "inline";

export function readStringField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

export function getImageUpload(formData: FormData): File | null {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

export function parseAssetRole(value: string):
  | {
      role: GuideAssetRole;
      errors: [];
    }
  | {
      role: null;
      errors: string[];
    } {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return { role: "inline", errors: [] };
  }

  if (trimmedValue === "cover" || trimmedValue === "inline") {
    return { role: trimmedValue, errors: [] };
  }

  return {
    role: null,
    errors: ["Guide image role must be cover or inline."],
  };
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

export function buildStoragePath(mimeType: string): string {
  const extension = getUploadExtension(mimeType);

  if (!extension) {
    throw new Error("Unsupported upload MIME type");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `guides/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export function buildUploadHistoryRow({
  assetRole,
  guideId,
  path,
  publicUrl,
}: {
  assetRole: GuideAssetRole;
  guideId: string | null;
  path: string;
  publicUrl: string;
}) {
  return {
    asset_role: assetRole,
    guide_id: guideId,
    storage_bucket: GUIDE_ASSETS_BUCKET,
    storage_path: path,
    public_url: publicUrl,
    is_current: true,
  };
}

async function removeUploadedAsset(
  supabase: HomeConfigSupabaseClient,
  path: string,
) {
  await supabase.storage.from(GUIDE_ASSETS_BUCKET).remove([path]);
}

export async function uploadAdminGuideAsset(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: ["Request body must be multipart/form-data."] }, { status: 400 });
  }

  const file = getImageUpload(formData);

  if (!file) {
    return Response.json({ errors: ["à¸•à¹‰à¸­à¸‡à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¸šà¸—à¸„à¸§à¸²à¸¡"] }, { status: 400 });
  }

  const errors = validateGuideUploadMetadata(file.type, file.size);
  const assetRoleResult = parseAssetRole(readStringField(formData, "role"));

  errors.push(...assetRoleResult.errors);

  if (errors.length > 0 || !assetRoleResult.role) {
    return Response.json({ errors }, { status: 400 });
  }

  const assetRole = assetRoleResult.role;
  const guideId = readStringField(formData, "guideId").trim() || null;
  const alt = readStringField(formData, "alt").trim();
  const path = buildStoragePath(file.type);
  const { error: uploadError } = await supabase.storage
    .from(GUIDE_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return adminSupabaseErrorResponse(uploadError, "Unable to upload guide image.");
  }

  const { data } = supabase.storage
    .from(GUIDE_ASSETS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: historyError } = await supabase
    .from("guide_asset_uploads")
    .insert(buildUploadHistoryRow({ assetRole, guideId, path, publicUrl }))
    .select("id")
    .single();

  if (historyError) {
    await removeUploadedAsset(supabase, path);

    return adminSupabaseErrorResponse(
      historyError,
      "Unable to record guide image upload history.",
    );
  }

  return Response.json({
    image: {
      alt,
      path,
      url: publicUrl,
    },
  });
}
