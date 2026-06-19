import type { GuidePost } from "./types";

export interface PublicGuideSummary {
  coverImageAlt: string | null;
  hasCoverImage: boolean;
  excerpt: string;
  id: string;
  isPinned: boolean;
  slug: string;
  tags: string[];
  title: string;
}

export function toPublicGuideSummary(guide: GuidePost): PublicGuideSummary {
  return {
    coverImageAlt: guide.coverImage?.alt ?? null,
    hasCoverImage: Boolean(guide.coverImage?.url),
    excerpt: guide.excerpt,
    id: guide.id,
    isPinned: guide.isPinned,
    slug: guide.slug,
    tags: [...guide.tags],
    title: guide.title,
  };
}

export function toPublicGuideSummaries(
  guides: GuidePost[],
): PublicGuideSummary[] {
  return guides.map(toPublicGuideSummary);
}
