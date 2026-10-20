import { SEARCH_ZONE_OPTIONS } from "@/lib/villas/search-options";
import { ADVERTISEMENT_IMAGE_LIMIT, type AdvertisementDraft } from "./types";

export const ADVERTISEMENT_ZONES = [
  { label: "ทุกโซน", value: "all" },
  ...SEARCH_ZONE_OPTIONS,
];
export function isAdvertisementId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function isAdvertisementStoragePath(
  value: unknown,
  adId?: string,
): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  return (
    parts.length === 2 &&
    isAdvertisementId(parts[0]) &&
    (!adId || parts[0] === adId) &&
    parts[1].endsWith(".webp") &&
    isAdvertisementId(parts[1].slice(0, -5))
  );
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseAdvertisementDraft(value: unknown): {
  draft: AdvertisementDraft | null;
  errors: string[];
} {
  if (!isRecord(value))
    return { draft: null, errors: ["รูปแบบโฆษณาไม่ถูกต้อง"] };
  const errors: string[] = [];
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!isAdvertisementId(value.id)) errors.push("รหัสโฆษณาไม่ถูกต้อง");
  if (!title || title.length > 160)
    errors.push("กรุณาระบุชื่อโฆษณาไม่เกิน 160 ตัวอักษร");
  if (!ADVERTISEMENT_ZONES.some(({ value: zone }) => zone === value.zone))
    errors.push("กรุณาเลือกโซนที่ถูกต้อง");
  if (typeof value.isActive !== "boolean") errors.push("สถานะโฆษณาไม่ถูกต้อง");
  if (
    typeof value.sortOrder !== "number" ||
    !Number.isInteger(value.sortOrder) ||
    value.sortOrder < 0 ||
    value.sortOrder > 9999
  )
    errors.push("ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 9999");
  if (
    value.updatedAt !== null &&
    (typeof value.updatedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt) ||
      !Number.isFinite(Date.parse(value.updatedAt)))
  )
    errors.push("ข้อมูลเวอร์ชันโฆษณาไม่ถูกต้อง");
  const images: AdvertisementDraft["images"] = [];
  const seen = new Set<string>();
  if (
    !Array.isArray(value.images) ||
    value.images.length < 1 ||
    value.images.length > ADVERTISEMENT_IMAGE_LIMIT
  )
    errors.push(`กรุณาเลือกรูป 1–${ADVERTISEMENT_IMAGE_LIMIT} รูป`);
  else
    for (const image of value.images) {
      if (!isRecord(image)) {
        errors.push("ข้อมูลรูปไม่ถูกต้อง");
        continue;
      }
      let key: string;
      if (isAdvertisementId(image.id) && image.uploadIndex === undefined) {
        images.push({ id: image.id });
        key = image.id;
      } else if (
        image.id === undefined &&
        typeof image.uploadIndex === "number" &&
        Number.isInteger(image.uploadIndex) &&
        image.uploadIndex >= 0 &&
        image.uploadIndex < ADVERTISEMENT_IMAGE_LIMIT
      ) {
        images.push({ uploadIndex: image.uploadIndex });
        key = `upload-${image.uploadIndex}`;
      } else {
        errors.push("ข้อมูลรูปไม่ถูกต้อง");
        continue;
      }
      if (seen.has(key)) errors.push("มีรูปซ้ำในรายการ");
      seen.add(key);
    }
  return errors.length
    ? { draft: null, errors }
    : {
        draft: {
          id: value.id as string,
          title,
          zone: value.zone as string,
          isActive: value.isActive as boolean,
          sortOrder: value.sortOrder as number,
          updatedAt: value.updatedAt as string | null,
          images,
        },
        errors: [],
      };
}
export function validateAdvertisementUpload(
  file: Pick<File, "type" | "name" | "size">,
): string[] {
  const extensions = new Map([
    ["image/jpeg", ["jpg", "jpeg"]],
    ["image/png", ["png"]],
    ["image/webp", ["webp"]],
  ]);
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const errors: string[] = [];
  if (!extensions.get(file.type)?.includes(extension))
    errors.push("รูปต้องเป็น JPG, PNG หรือ WebP และนามสกุลต้องตรงกับชนิดไฟล์");
  if (file.size <= 0 || file.size > 6 * 1024 * 1024)
    errors.push("รูปต้องมีขนาดไม่เกิน 6 MB และไม่เป็นไฟล์ว่าง");
  return errors;
}
