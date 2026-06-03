import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
import { GUIDE_ASSETS_BUCKET } from "@/lib/guides/defaults";
import { validateGuideUploadMetadata } from "@/lib/guides/validation";

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

type AdminCheck = Awaited<ReturnType<typeof assertHomeConfigAdmin>>;
type HomeConfigSupabaseClient = Extract<AdminCheck, { ok: true }>["supabase"];
type GuideAssetRole = "cover" | "inline";

function supabaseErrorResponse(
  error: SupabaseLikeError | null | undefined,
  fallbackMessage: string,
) {
  return jsonError(error?.message ?? fallbackMessage, 403, {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
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

function getImageUpload(formData: FormData): File | null {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function normalizeAssetRole(value: string): GuideAssetRole {
  return value === "cover" ? "cover" : "inline";
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

function buildStoragePath(mimeType: string): string {
  const extension = getUploadExtension(mimeType);

  if (!extension) {
    throw new Error("Unsupported upload MIME type");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `guides/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function removeUploadedAsset(
  supabase: HomeConfigSupabaseClient,
  path: string,
) {
  await supabase.storage.from(GUIDE_ASSETS_BUCKET).remove([path]);
}

export async function POST(request: Request) {
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

  const file = getImageUpload(formData);

  if (!file) {
    return Response.json({ errors: ["ต้องเลือกรูปบทความ"] }, { status: 400 });
  }

  const errors = validateGuideUploadMetadata(file.type, file.size);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const assetRole = normalizeAssetRole(readStringField(formData, "role"));
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
    return supabaseErrorResponse(uploadError, "Unable to upload guide image.");
  }

  const { data } = admin.supabase.storage
    .from(GUIDE_ASSETS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: historyError } = await admin.supabase
    .from("guide_asset_uploads")
    .insert({
      asset_role: assetRole,
      guide_id: guideId,
      storage_bucket: GUIDE_ASSETS_BUCKET,
      storage_path: path,
      public_url: publicUrl,
      is_current: true,
    })
    .select("id")
    .single();

  if (historyError) {
    await removeUploadedAsset(admin.supabase, path);

    return supabaseErrorResponse(
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
