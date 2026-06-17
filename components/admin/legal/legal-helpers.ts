import { LEGAL_PAGE_DEFAULTS } from "@/lib/legal-pages/defaults";
import {
  LEGAL_PAGE_SLUGS,
  type LegalPage,
  type LegalPageSlug,
} from "@/lib/legal-pages/types";
import {
  formatAdminErrorMessage,
  translateAdminErrorMessages,
} from "@/components/admin/admin-error-messages";

import type {
  AdminLegalDraft,
  AdminLegalSavePayload,
  AdminLegalTextBlock,
} from "./types";

const ADMIN_ACCESS_ERROR_PREFIX = "Unable to verify admin access:";
const AUTH_FAILURE_MESSAGES = new Set([
  "Invalid or expired Supabase session. Please sign in again.",
  "Signed-in user is not listed as an active home config admin.",
]);

interface ErrorPayloadParts {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  errors?: unknown;
  hint?: unknown;
}

interface LegalContentNode {
  content?: unknown;
  type?: unknown;
}

interface LegalContentTextNode {
  text?: unknown;
  type?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLegalPageSlug(value: unknown): value is LegalPageSlug {
  return (
    typeof value === "string" && (LEGAL_PAGE_SLUGS as readonly string[]).includes(value)
  );
}

function isLegalPageStatus(value: unknown): value is AdminLegalDraft["status"] {
  return value === "draft" || value === "published";
}

function isSupportedLegalBlockType(
  type: unknown,
): type is AdminLegalTextBlock["type"] {
  return (
    type === "paragraph" ||
    type === "heading" ||
    type === "bulletListItem" ||
    type === "numberedListItem" ||
    type === "quote"
  );
}

function isLegalTextNode(value: unknown): value is LegalContentTextNode {
  return (
    isRecord(value) &&
    value.type === "text" &&
    typeof value.text === "string"
  );
}

function getBlockText(block: LegalContentNode): string {
  if (!Array.isArray(block.content)) {
    return "";
  }

  return block.content
    .filter(isLegalTextNode)
    .map((content) => content.text)
    .join("")
    .trim();
}

function normalizeLine(value: string): string {
  return value.trim();
}

function normalizeLegalLineEndings(value: string): string {
  let normalized = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\r") {
      normalized += "\n";

      if (value[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    normalized += character;
  }

  return normalized;
}

function splitLegalTextSections(value: string): string[] {
  const sections: string[] = [];
  let sectionStart = 0;
  let newlineRun = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\n") {
      newlineRun = 0;
      continue;
    }

    newlineRun += 1;

    if (newlineRun < 2) {
      continue;
    }

    const sectionEnd = index - newlineRun + 1;
    const section = value.slice(sectionStart, sectionEnd);

    if (normalizeLine(section).length > 0) {
      sections.push(section);
    }

    sectionStart = index + 1;
  }

  const finalSection = value.slice(sectionStart);

  if (normalizeLine(finalSection).length > 0) {
    sections.push(finalSection);
  }

  return sections;
}

function readNumberedListText(value: string): string | null {
  let digitEnd = 0;

  while (digitEnd < value.length) {
    const codePoint = value.charCodeAt(digitEnd);

    if (codePoint < 48 || codePoint > 57) {
      break;
    }

    digitEnd += 1;
  }

  if (digitEnd === 0 || value[digitEnd] !== ".") {
    return null;
  }

  const separatorIndex = digitEnd + 1;
  const separator = value[separatorIndex];

  if (separator !== " " && separator !== "\t") {
    return null;
  }

  const parsedNumber = Number.parseInt(value.slice(0, digitEnd), 10);

  if (!Number.isFinite(parsedNumber)) {
    return null;
  }

  let textStart = separatorIndex;

  while (textStart < value.length) {
    const character = value[textStart];

    if (character !== " " && character !== "\t") {
      break;
    }

    textStart += 1;
  }

  const text = value.slice(textStart);

  return text.length > 0 ? text : null;
}

function toTextBlock(
  type: AdminLegalTextBlock["type"],
  text: string,
): AdminLegalTextBlock {
  return {
    type,
    content: [{ type: "text", text }],
  };
}

export function shouldRedirectToLogin(
  status: number,
  payload: unknown,
): boolean {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = isRecord(payload)
    ? (payload as { error?: unknown }).error
    : undefined;

  return (
    typeof message === "string" &&
    (AUTH_FAILURE_MESSAGES.has(message) ||
      message.startsWith(ADMIN_ACCESS_ERROR_PREFIX))
  );
}

export function extractLegalErrors(
  payload: unknown,
  fallback: string,
): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const errorPayload = payload as ErrorPayloadParts;

  if (Array.isArray(errorPayload.errors)) {
    const errors = errorPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return translateAdminErrorMessages(errors);
    }
  }

  if (typeof errorPayload.error === "string" && errorPayload.error.length > 0) {
    const detailParts = [
      typeof errorPayload.code === "string" ? errorPayload.code : null,
      typeof errorPayload.details === "string" ? errorPayload.details : null,
      typeof errorPayload.hint === "string" ? errorPayload.hint : null,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);

    return [formatAdminErrorMessage(errorPayload.error, detailParts)];
  }

  return [fallback];
}

export async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) {
    return "";
  }

  const lines = blocks.flatMap((block) => {
    if (!isRecord(block) || !isSupportedLegalBlockType(block.type)) {
      return [];
    }

    const text = normalizeLine(getBlockText(block));

    if (text.length === 0) {
      return [];
    }

    const prefix =
      block.type === "heading"
        ? "# "
        : block.type === "quote"
          ? "> "
          : block.type === "bulletListItem"
            ? "- "
            : block.type === "numberedListItem"
              ? "1. "
              : "";

    return [`${prefix}${text}`];
  });

  return lines.join("\n\n");
}

export function textToBlocks(value: string): AdminLegalTextBlock[] {
  const normalizedText = normalizeLegalLineEndings(value);

  if (normalizeLine(normalizedText).length === 0) {
    return [];
  }

  const sections = splitLegalTextSections(normalizedText);
  const outputBlocks: AdminLegalTextBlock[] = [];

  for (const section of sections) {
    for (const rawLine of section.split("\n")) {
      const trimmedLine = rawLine.trim();

      if (trimmedLine.length === 0) {
        continue;
      }

      if (trimmedLine.startsWith("# ")) {
        outputBlocks.push(toTextBlock("heading", trimmedLine.slice(2)));
        continue;
      }

      if (trimmedLine.startsWith("> ")) {
        outputBlocks.push(toTextBlock("quote", trimmedLine.slice(2)));
        continue;
      }

      if (trimmedLine.startsWith("- ")) {
        outputBlocks.push(toTextBlock("bulletListItem", trimmedLine.slice(2)));
        continue;
      }

      const numberedText = readNumberedListText(trimmedLine);
      if (numberedText !== null) {
        outputBlocks.push(toTextBlock("numberedListItem", numberedText));
        continue;
      }

      outputBlocks.push(toTextBlock("paragraph", trimmedLine));
    }
  }

  return outputBlocks;
}

export function mapLegalPageToDraft(page: LegalPage): AdminLegalDraft {
  return {
    contentText: blocksToText(page.contentBlocks),
    id: page.id,
    publishedAt: page.publishedAt,
    seoDescription: page.seoDescription,
    slug: page.slug,
    status: page.status,
    title: page.title,
    updatedAt: page.updatedAt,
  };
}

// Keep both legal editor tabs renderable even when Supabase rows are missing
// or partially shaped by falling back to the repo defaults per slug.
export function normalizeLegalDrafts(payload: unknown): AdminLegalDraft[] {
  const rawPages = isRecord(payload)
    ? ((payload as { legalPages?: unknown }).legalPages as unknown)
    : null;
  const list = Array.isArray(rawPages) ? rawPages : [];

  const pageBySlug = new Map<LegalPageSlug, LegalPage>();

  list.forEach((value) => {
    if (!isRecord(value) || !isLegalPageSlug(value.slug)) {
      return;
    }

    const slug = value.slug;
    const fallback = LEGAL_PAGE_DEFAULTS[slug];
    const status = isLegalPageStatus(value.status)
      ? value.status
      : isLegalPageStatus(value.page_status)
        ? value.page_status
        : "draft";

    const rawPublishedAt =
      typeof value.publishedAt === "string"
        ? value.publishedAt
        : typeof value.published_at === "string"
          ? value.published_at
          : null;

    const rawContentBlocks = Array.isArray(value.contentBlocks)
      ? value.contentBlocks
      : Array.isArray(value.content_blocks)
        ? value.content_blocks
        : fallback.contentBlocks;

    pageBySlug.set(slug, {
      id:
        typeof value.id === "string" && value.id.length > 0
          ? value.id
          : fallback.id,
      slug,
      title:
        typeof value.title === "string" && value.title.trim().length > 0
          ? value.title
          : fallback.title,
      seoDescription:
        typeof value.seoDescription === "string"
          ? value.seoDescription
          : typeof value.seo_description === "string"
            ? value.seo_description
            : fallback.seoDescription,
      contentBlocks: rawContentBlocks,
      status,
      publishedAt: status === "published" ? rawPublishedAt : null,
      createdAt:
        typeof value.createdAt === "string"
          ? value.createdAt
          : typeof value.created_at === "string"
            ? value.created_at
            : fallback.createdAt,
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : typeof value.updated_at === "string"
            ? value.updated_at
            : fallback.updatedAt,
    });
  });

  return LEGAL_PAGE_SLUGS.map((slug) =>
    mapLegalPageToDraft(pageBySlug.get(slug) ?? LEGAL_PAGE_DEFAULTS[slug]),
  );
}

export function makeSavePayload(draft: AdminLegalDraft): AdminLegalSavePayload {
  return {
    legalPage: {
      contentBlocks: textToBlocks(draft.contentText),
      publishedAt: draft.status === "published" ? draft.publishedAt : null,
      seoDescription: draft.seoDescription,
      slug: draft.slug,
      status: draft.status,
      title: draft.title,
    },
  };
}

export function makeLegalSnapshot(drafts: AdminLegalDraft[]): string {
  return JSON.stringify(
    drafts.map((draft) => ({
      contentText: draft.contentText,
      id: draft.id,
      publishedAt: draft.publishedAt,
      seoDescription: draft.seoDescription,
      slug: draft.slug,
      status: draft.status,
      title: draft.title,
      updatedAt: draft.updatedAt,
    })),
  );
}

export function legalDateLabel(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function pageLabel(slug: LegalPageSlug): string {
  return slug === "terms" ? "เงื่อนไขการใช้งาน" : "นโยบายความเป็นส่วนตัว";
}

export function buildPagePreview(draft: AdminLegalDraft): LegalPage {
  return {
    id: draft.id,
    slug: draft.slug,
    title: draft.title,
    seoDescription: draft.seoDescription,
    contentBlocks: textToBlocks(draft.contentText),
    status: draft.status,
    publishedAt: draft.status === "published" ? draft.publishedAt : null,
    createdAt: "",
    updatedAt: draft.updatedAt,
  };
}
