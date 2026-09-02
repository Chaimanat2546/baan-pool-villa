export const GALLERY_CATEGORY_KEYS = [
  "cover",
  "outside",
  "pool",
  "inside",
  "livingroom",
  "bedroom",
  "kitchen",
  "bathroom",
  "parking",
  "review",
] as const;

export type GalleryCategoryKey = (typeof GALLERY_CATEGORY_KEYS)[number];

export const DEFAULT_GALLERY_CATEGORY_ORDER: GalleryCategoryKey[] = [
  ...GALLERY_CATEGORY_KEYS,
];

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategoryKey, string> = {
  bathroom: "ห้องน้ำ",
  bedroom: "ห้องนอน",
  cover: "รูปปก",
  inside: "ภายในบ้าน",
  kitchen: "ครัว",
  livingroom: "ห้องนั่งเล่น",
  outside: "ภายนอกบ้าน",
  parking: "ที่จอดรถ",
  pool: "สระว่ายน้ำ",
  review: "รีวิว",
};

export function isGalleryCategoryOrder(value: unknown): value is GalleryCategoryKey[] {
  return (
    Array.isArray(value) &&
    value.length === GALLERY_CATEGORY_KEYS.length &&
    new Set(value).size === GALLERY_CATEGORY_KEYS.length &&
    value.every((key) => GALLERY_CATEGORY_KEYS.includes(key as GalleryCategoryKey))
  );
}
