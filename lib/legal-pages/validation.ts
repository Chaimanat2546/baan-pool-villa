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

export function isLegalPageSlug(value: unknown): value is LegalPageSlug {
  return (
    typeof value === "string" && LEGAL_PAGE_SLUGS.includes(value as LegalPageSlug)
  );
}

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

export function validateLegalPageDraft(draft: LegalPageDraft): string[] {
  const errors: string[] = [];
  const normalizedDraft = normalizeLegalPageDraftForSave(draft);
  const normalizedTitle = normalizedDraft.title;
  const normalizedSeoDescription = normalizedDraft.seoDescription;

  if (!isLegalPageSlug(draft.slug)) {
    errors.push("Legal page slug is invalid.");
  }

  if (normalizedTitle.length === 0) {
    errors.push("Legal page title is required.");
  } else if (normalizedTitle.length > LEGAL_PAGE_TITLE_MAX_LENGTH) {
    errors.push("Legal page title must be at most 120 characters.");
  }

  if (normalizedSeoDescription.length > LEGAL_PAGE_SEO_DESCRIPTION_MAX_LENGTH) {
    errors.push("SEO description must be at most 220 characters.");
  }

  if (!isLegalPageStatus(draft.status)) {
    errors.push("Legal page status is invalid.");
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
      return ["Published legal pages must include at least one content block."];
    }

    return [];
  }

  if (contentBlocks.length === 0) {
    if (status === "published") {
      return ["Published legal pages must include at least one content block."];
    }

    return [];
  }

  const errors: string[] = [];
  let hasPublishableContent = false;

  contentBlocks.forEach((block, index) => {
    if (!isRecord(block) || typeof block.type !== "string") {
      errors.push(`Content block ${index + 1} is invalid.`);
      return;
    }

    if (!LEGAL_PAGE_ALLOWED_BLOCK_TYPES.has(block.type)) {
      errors.push(`Content block ${index + 1} has unsupported type.`);
      return;
    }

    if (hasTextContent(block)) {
      hasPublishableContent = true;
    }
  });

  if (status === "published" && !hasPublishableContent) {
    errors.push(
      "Published legal pages require at least one text block with non-empty content.",
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
