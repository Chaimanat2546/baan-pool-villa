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
