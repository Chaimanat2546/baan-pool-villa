import type {
  GuideDraft,
  GuideImage,
  GuidePost,
  GuidePostRow,
  GuideSavePayload,
  GuideStatus,
} from "./types";

const FALLBACK_SLUG = "guide-draft";
const GUIDE_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;
const GUIDE_COVER_ALT_MAX_LENGTH = 180;
const GUIDE_EXCERPT_MAX_LENGTH = 220;
const GUIDE_TITLE_MAX_LENGTH = 120;
const GUIDE_TAGS_MAX_COUNT = 12;
const GUIDE_RECOMMENDED_HOUSE_IDS_MAX_COUNT = 12;
const GUIDE_ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const GUIDE_ALLOWED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "image",
]);

export type GuideDraftValidationField =
  | "title"
  | "excerpt"
  | "status"
  | "tags"
  | "recommendedHouseIds"
  | "coverImage"
  | "coverImageAlt"
  | "contentBlocks";

export interface GuideDraftValidationError {
  field: GuideDraftValidationField;
  message: string;
}

function addGuideDraftError(
  errors: GuideDraftValidationError[],
  field: GuideDraftValidationField,
  message: string,
) {
  errors.push({ field, message });
}

/**
 * Creates a normalized slug from a guide title.
 *
 * @param title - The raw guide title or slug-like input.
 * @returns The normalized slug, or a fallback slug when the input is empty.
 */
export function createSlugFromTitle(title: string): string {
  const slug = title
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug.length > 0 ? slug : FALLBACK_SLUG;
}

/**
 * Builds a unique guide slug that avoids collisions with existing guide slugs.
 *
 * @param slug - The desired guide title or slug-like input.
 * @param existingSlugs - The slugs that already exist in the guide CMS.
 * @param currentSlug - The current slug to preserve during edits when unchanged.
 * @returns A normalized slug that does not collide with existing guide slugs.
 */
export function buildUniqueSlug(
  slug: string,
  existingSlugs: string[],
  currentSlug?: string,
): string {
  const baseSlug = createSlugFromTitle(slug);
  const current = currentSlug ? createSlugFromTitle(currentSlug) : null;
  const existing = new Set(
    existingSlugs
      .map((existingSlug) => createSlugFromTitle(existingSlug))
      .filter((existingSlug) => existingSlug !== current),
  );

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;

  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

/**
 * Normalizes a free-form house id into the numeric id format used by guides
 * and villa data.
 *
 * @param value - The raw house id entered in the guide editor.
 * @returns The normalized numeric house id, or `null` when invalid.
 */
export function normalizeGuideHouseId(value: string): string | null {
  const compactValue = value.trim().replace(/\s+/g, "");

  if (compactValue.length === 0) {
    return null;
  }

  const id = compactValue.replace(/^(?:dv|bpv)-?/i, "");

  if (!/^\d+$/.test(id)) {
    return null;
  }

  const numericId = Number(id);

  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    return null;
  }

  return String(numericId);
}

/**
 * Validates a guide draft and returns admin-facing error messages for invalid
 * guide content.
 *
 * @param draft - The guide draft collected from the admin editor.
 * @returns User-facing validation error messages, or an empty array when valid.
 */
export function validateGuideDraft(draft: GuideDraft): string[] {
  return validateGuideDraftDetailed(draft).map((error) => error.message);
}

export function validateGuideDraftDetailed(
  draft: GuideDraft,
): GuideDraftValidationError[] {
  const errors: GuideDraftValidationError[] = [];
  const normalizedDraft = normalizeGuideDraftForSave(draft);
  const title = draft.title.trim();
  const excerpt = draft.excerpt.trim();

  if (title.length === 0) {
    addGuideDraftError(errors, "title", "ต้องใส่ชื่อบทความ");
  } else if (title.length > GUIDE_TITLE_MAX_LENGTH) {
    addGuideDraftError(errors, "title", "ชื่อบทความต้องไม่เกิน 120 ตัวอักษร");
  }

  if (excerpt.length === 0) {
    addGuideDraftError(errors, "excerpt", "ต้องใส่คำโปรยบทความ");
  } else if (excerpt.length > GUIDE_EXCERPT_MAX_LENGTH) {
    addGuideDraftError(errors, "excerpt", "คำโปรยบทความต้องไม่เกิน 220 ตัวอักษร");
  }

  if (draft.status !== "draft" && draft.status !== "published") {
    addGuideDraftError(errors, "status", "สถานะบทความไม่ถูกต้อง");
  }

  if (draft.tags.length === 0) {
    addGuideDraftError(errors, "tags", "ควรใส่แท็กอย่างน้อย 1 แท็ก");
  } else if (normalizedDraft.tags.length > GUIDE_TAGS_MAX_COUNT) {
    addGuideDraftError(errors, "tags", "แท็กบทความต้องไม่เกิน 12 แท็ก");
  }

  if (
    normalizedDraft.recommendedHouseIds.length >
    GUIDE_RECOMMENDED_HOUSE_IDS_MAX_COUNT
  ) {
    addGuideDraftError(
      errors,
      "recommendedHouseIds",
      "บ้านพักแนะนำต้องไม่เกิน 12 หลัง",
    );
  }

  validateRecommendedHouseIds(draft.recommendedHouseIds, errors);
  validateGuideCoverImage(draft.coverImage, draft.status, errors);
  validateGuideContentBlocks(draft.contentBlocks, draft.status, errors);

  return errors;
}

/**
 * Normalizes a mutable guide draft into the payload shape expected by the save
 * API.
 *
 * @param draft - The guide draft from the admin editor.
 * @returns A normalized guide payload ready for persistence.
 */
export function normalizeGuideDraftForSave(
  draft: GuideDraft,
): GuideSavePayload {
  return {
    title: draft.title.trim(),
    slug: createSlugFromTitle(draft.slug || draft.title),
    excerpt: draft.excerpt.trim(),
    coverImage: normalizeGuideImage(draft.coverImage),
    contentBlocks: Array.isArray(draft.contentBlocks) ? draft.contentBlocks : [],
    tags: normalizeTags(draft.tags),
    recommendedHouseIds: normalizeRecommendedHouseIds(draft.recommendedHouseIds),
    status: isGuideStatus(draft.status) ? draft.status : "draft",
    isPinned: draft.isPinned,
    publishedAt: draft.status === "published" ? draft.publishedAt : null,
  };
}

/**
 * Normalizes a raw guide-post row from Supabase into the shared guide-post
 * shape used by public and admin consumers.
 *
 * @param row - The raw guide-post row returned by Supabase.
 * @returns The normalized guide post.
 */
export function normalizeGuidePostRow(row: GuidePostRow): GuidePost {
  const status = isGuideStatus(row.status) ? row.status : "draft";

  return {
    id: row.id,
    title: row.title.trim(),
    slug: createSlugFromTitle(row.slug),
    excerpt: row.excerpt.trim(),
    coverImage: normalizeGuideImage({
      alt: row.cover_image_alt ?? "",
      path: row.cover_image_path ?? "",
      url: row.cover_image_url ?? "",
    }),
    contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : [],
    tags: normalizeTags(row.tags),
    recommendedHouseIds: normalizeRecommendedHouseIds(row.recommended_house_ids),
    status,
    isPinned: row.is_pinned === true,
    publishedAt: status === "published" ? row.published_at : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Validates uploaded guide image metadata before assets are saved.
 *
 * @param mimeType - The uploaded file MIME type.
 * @param sizeBytes - The uploaded file size in bytes.
 * @returns User-facing validation error messages for invalid upload metadata.
 */
export function validateGuideUploadMetadata(
  mimeType: string,
  sizeBytes: number,
): string[] {
  const errors: string[] = [];

  if (!GUIDE_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    errors.push("รูปบทความต้องเป็น JPG, PNG หรือ WebP");
  }

  if (sizeBytes > GUIDE_UPLOAD_LIMIT_BYTES) {
    errors.push("รูปบทความต้องมีขนาดไม่เกิน 6MB");
  }

  return errors;
}

function validateRecommendedHouseIds(
  values: string[],
  errors: GuideDraftValidationError[],
) {
  const seenHouseIds = new Set<string>();

  values.forEach((value, index) => {
    const normalizedHouseId = normalizeGuideHouseId(value);

    if (!normalizedHouseId) {
      addGuideDraftError(
        errors,
        "recommendedHouseIds",
        `รหัสบ้านพักลำดับที่ ${index + 1} ไม่ถูกต้อง`,
      );
      return;
    }

    if (seenHouseIds.has(normalizedHouseId)) {
      addGuideDraftError(
        errors,
        "recommendedHouseIds",
        `มีรหัสบ้านพัก ${normalizedHouseId} ซ้ำ`,
      );
    } else {
      seenHouseIds.add(normalizedHouseId);
    }
  });
}

function validateGuideCoverImage(
  image: GuideImage | null,
  status: GuideStatus,
  errors: GuideDraftValidationError[],
) {
  if (image === null) {
    if (status === "published") {
      addGuideDraftError(errors, "coverImage", "บทความที่เผยแพร่ต้องมีรูปปก");
    }

    return;
  }

  if (!isPublicImageUrl(image.url)) {
    addGuideDraftError(
      errors,
      "coverImage",
      "ลิงก์รูปปกต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /",
    );
  }

  if (image.alt.trim().length === 0) {
    addGuideDraftError(errors, "coverImageAlt", "ต้องใส่คำอธิบายรูปปก");
  } else if (image.alt.length > GUIDE_COVER_ALT_MAX_LENGTH) {
    addGuideDraftError(
      errors,
      "coverImageAlt",
      "คำอธิบายรูปปกต้องไม่เกิน 180 ตัวอักษร",
    );
  }
}

function validateGuideContentBlocks(
  contentBlocks: unknown[],
  status: GuideStatus,
  errors: GuideDraftValidationError[],
) {
  if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
    if (status === "published") {
      addGuideDraftError(
        errors,
        "contentBlocks",
        "บทความที่เผยแพร่ต้องมีเนื้อหาอย่างน้อย 1 บล็อก",
      );
    }

    return;
  }

  contentBlocks.forEach((block, index) => {
    if (!isRecord(block) || typeof block.type !== "string") {
      addGuideDraftError(
        errors,
        "contentBlocks",
        `บล็อกเนื้อหาลำดับที่ ${index + 1} ไม่ถูกต้อง`,
      );
      return;
    }

    if (!GUIDE_ALLOWED_BLOCK_TYPES.has(block.type)) {
      addGuideDraftError(
        errors,
        "contentBlocks",
        `ชนิดบล็อกเนื้อหาลำดับที่ ${index + 1} ไม่รองรับ`,
      );
    }
  });
}

function normalizeGuideImage(image: GuideImage | null): GuideImage | null {
  if (image === null) {
    return null;
  }

  const path = image.path.trim();
  const url = image.url.trim();
  const alt = image.alt.trim();

  if (path.length === 0 || url.length === 0) {
    return null;
  }

  return {
    alt,
    path,
    url,
  };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return [...new Set(tags)];
}

function normalizeRecommendedHouseIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const houseIds = value
    .filter((houseId): houseId is string => typeof houseId === "string")
    .map((houseId) => normalizeGuideHouseId(houseId))
    .filter((houseId): houseId is string => houseId !== null);

  return [...new Set(houseIds)];
}

function isGuideStatus(value: unknown): value is GuideStatus {
  return value === "draft" || value === "published";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicImageUrl(value: string): boolean {
  return (
    (value.startsWith("/") && !value.startsWith("//")) ||
    isHttpUrl(value)
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
