export const LEGAL_PAGE_SLUGS = ["terms", "privacy"] as const;
export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];
export type LegalPageStatus = "draft" | "published";

export const LEGAL_PAGE_PATHS: Record<LegalPageSlug, `/${LegalPageSlug}`> = {
  privacy: "/privacy",
  terms: "/terms",
} as const;

/**
 * Resolves the public route path for a legal-page slug.
 *
 * @param slug - The legal-page slug to map.
 * @returns The public route path for the requested legal page.
 */
export function getLegalPagePath(slug: LegalPageSlug): `/${LegalPageSlug}` {
  return LEGAL_PAGE_PATHS[slug];
}

export interface LegalPageDraft {
  slug: LegalPageSlug;
  title: string;
  seoDescription: string;
  contentBlocks: unknown[];
  status: LegalPageStatus;
  publishedAt: string | null;
}

export interface LegalPage extends LegalPageDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalPageRow {
  id: string;
  slug: string;
  title: string;
  seo_description: string | null;
  content_blocks: unknown;
  status: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
