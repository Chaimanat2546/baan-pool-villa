import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import type { HomeConfigSupabaseClient } from "@/lib/admin/route-helpers";
import { GUIDE_ASSETS_BUCKET } from "@/lib/guides/defaults";
import { validateGuideUploadMetadata } from "@/lib/guides/validation";
import {
  buildStoragePath,
  buildUploadHistoryRow,
  getImageUpload,
  parseAssetRole,
  readStringField,
} from "@/lib/guides/admin-assets-route";

async function removeUploadedAsset(
  supabase: HomeConfigSupabaseClient,
  path: string,
) {
  await supabase.storage.from(GUIDE_ASSETS_BUCKET).remove([path]);
}

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: ["Request body must be multipart/form-data."] }, { status: 400 });
  }

  const file = getImageUpload(formData);

  if (!file) {
    return Response.json({ errors: ["ต้องเลือกรูปบทความ"] }, { status: 400 });
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
  const { error: uploadError } = await admin.supabase.storage
    .from(GUIDE_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return adminSupabaseErrorResponse(uploadError, "Unable to upload guide image.");
  }

  const { data } = admin.supabase.storage
    .from(GUIDE_ASSETS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: historyError } = await admin.supabase
    .from("guide_asset_uploads")
    .insert(buildUploadHistoryRow({ assetRole, guideId, path, publicUrl }))
    .select("id")
    .single();

  if (historyError) {
    await removeUploadedAsset(admin.supabase, path);

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
