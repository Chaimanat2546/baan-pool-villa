import {
  LEGAL_PAGE_SLUGS,
  type LegalPage,
  type LegalPageDraft,
  type LegalPageRow,
  type LegalPageSlug,
  type LegalPageStatus,
} from "./types";

const LEGAL_PAGE_TITLE_MAX_LENGTH = 120;
const LEGAL_PAGE_SEO_DESCRIPTION_MAX_LENGTH = 220;
const LEGAL_PAGE_ALLOWED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "quote",
]);

/**
 * Checks whether a value is one of the supported legal-page slugs.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a supported legal-page slug.
 */
export function isLegalPageSlug(value: unknown): value is LegalPageSlug {
  return (
    typeof value === "string" && LEGAL_PAGE_SLUGS.includes(value as LegalPageSlug)
  );
}

/**
 * Normalizes a legal-page draft into the payload shape expected by the save
 * API.
 *
 * @param draft - The legal-page draft from the admin editor.
 * @returns A normalized legal-page draft ready for persistence.
 */
export function normalizeLegalPageDraftForSave(
  draft: LegalPageDraft,
): LegalPageDraft {
  return {
    slug: draft.slug,
    title: draft.title.trim(),
    seoDescription: draft.seoDescription.trim(),
    contentBlocks: Array.isArray(draft.contentBlocks) ? draft.contentBlocks : [],
    status: draft.status,
    publishedAt: draft.status === "published" ? draft.publishedAt : null,
  };
}

/**
 * Normalizes a raw legal-page row from Supabase into the shared legal-page
 * shape used by public and admin consumers.
 *
 * @param row - The raw legal-page row returned by Supabase.
 * @returns The normalized legal page.
 */
export function normalizeLegalPageRow(row: LegalPageRow): LegalPage {
  const status = isLegalPageStatus(row.status) ? row.status : "draft";

  return {
    id: row.id,
    slug: normalizeLegalPageSlug(row.slug),
    title: row.title.trim(),
    seoDescription: row.seo_description?.trim() ?? "",
    contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : [],
    status,
    publishedAt: status === "published" ? row.published_at : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Validates a legal-page draft and returns admin-facing error messages for
 * invalid content.
 *
 * @param draft - The legal-page draft collected from the admin editor.
 * @returns User-facing validation error messages, or an empty array when valid.
 */
export function validateLegalPageDraft(draft: LegalPageDraft): string[] {
  const errors: string[] = [];
  const normalizedDraft = normalizeLegalPageDraftForSave(draft);
  const normalizedTitle = normalizedDraft.title;
  const normalizedSeoDescription = normalizedDraft.seoDescription;

  if (!isLegalPageSlug(draft.slug)) {
    errors.push("Slug ของหน้ากฎหมายไม่ถูกต้อง");
  }

  if (normalizedTitle.length === 0) {
    errors.push("ต้องใส่ชื่อหน้ากฎหมาย");
  } else if (normalizedTitle.length > LEGAL_PAGE_TITLE_MAX_LENGTH) {
    errors.push("ชื่อหน้ากฎหมายต้องไม่เกิน 120 ตัวอักษร");
  }

  if (normalizedSeoDescription.length > LEGAL_PAGE_SEO_DESCRIPTION_MAX_LENGTH) {
    errors.push("คำอธิบาย SEO ต้องไม่เกิน 220 ตัวอักษร");
  }

  if (!isLegalPageStatus(draft.status)) {
    errors.push("สถานะหน้ากฎหมายไม่ถูกต้อง");
  }

  const contentErrors = validateLegalPageContentBlocks(
    normalizedDraft.contentBlocks,
    draft.status,
  );

  errors.push(...contentErrors);

  return errors;
}

function validateLegalPageContentBlocks(
  contentBlocks: unknown,
  status: LegalPageStatus,
): string[] {
  if (!Array.isArray(contentBlocks)) {
    if (status === "published") {
      return ["หน้ากฎหมายที่เผยแพร่ต้องมีเนื้อหาอย่างน้อย 1 บล็อก"];
    }

    return [];
  }

  if (contentBlocks.length === 0) {
    if (status === "published") {
      return ["หน้ากฎหมายที่เผยแพร่ต้องมีเนื้อหาอย่างน้อย 1 บล็อก"];
    }

    return [];
  }

  const errors: string[] = [];
  let hasPublishableContent = false;

  contentBlocks.forEach((block, index) => {
    if (!isRecord(block) || typeof block.type !== "string") {
      errors.push(`บล็อกเนื้อหาลำดับที่ ${index + 1} ไม่ถูกต้อง`);
      return;
    }

    if (!LEGAL_PAGE_ALLOWED_BLOCK_TYPES.has(block.type)) {
      errors.push(`บล็อกเนื้อหาลำดับที่ ${index + 1} เป็นชนิดที่ไม่รองรับ`);
      return;
    }

    if (hasTextContent(block)) {
      hasPublishableContent = true;
    }
  });

  if (status === "published" && !hasPublishableContent) {
    errors.push(
      "หน้ากฎหมายที่เผยแพร่ต้องมีบล็อกข้อความที่มีเนื้อหาอย่างน้อย 1 บล็อก",
    );
  }

  return errors;
}

function hasTextContent(block: Record<string, unknown>): boolean {
  if (!Array.isArray(block.content)) {
    return false;
  }

  return block.content.some((contentNode) => {
    return (
      isRecord(contentNode) &&
      contentNode.type === "text" &&
      typeof contentNode.text === "string" &&
      contentNode.text.trim().length > 0
    );
  });
}

function normalizeLegalPageSlug(value: string): LegalPageSlug {
  const normalizedValue = value.trim();

  return isLegalPageSlug(normalizedValue) ? normalizedValue : "terms";
}

function isLegalPageStatus(value: unknown): value is LegalPageStatus {
  return value === "draft" || value === "published";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
