import type { LegalPage, LegalPageSlug, LegalPageStatus } from "@/lib/legal-pages/types";

export interface AdminLegalDraft {
  id: string;
  slug: LegalPageSlug;
  title: string;
  seoDescription: string;
  contentText: string;
  status: LegalPageStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminLegalResponse {
  legalPages: LegalPage[];
}

export interface LegalApiErrorPayload {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  errors?: unknown;
  hint?: unknown;
}

export interface AdminLegalSavePayload {
  legalPage: {
    slug: LegalPageSlug;
    title: string;
    seoDescription: string;
    contentBlocks: unknown[];
    status: LegalPageStatus;
    publishedAt: string | null;
  };
}

export interface LegalContentTextNode {
  type: "text";
  text: string;
}

export interface AdminLegalTextBlock {
  type: "paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "quote";
  content: LegalContentTextNode[];
}
