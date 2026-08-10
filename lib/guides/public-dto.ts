import type { GuidePost } from "./types";
import {
  buildGuideCoverImageProxyPath,
  normalizePublicImageSourceUrl,
} from "@/lib/public-image-proxy";

export interface PublicGuideSummary {
  coverImageAlt: string | null;
  coverImageUrl: string | null;
  hasCoverImage: boolean;
  excerpt: string;
  id: string;
  isPinned: boolean;
  slug: string;
  tags: string[];
  title: string;
}

export function toPublicGuideSummary(guide: GuidePost): PublicGuideSummary {
  const coverImageUrl = normalizePublicImageSourceUrl(guide.coverImage?.url ?? null);

  return {
    coverImageAlt: guide.coverImage?.alt ?? null,
    coverImageUrl: coverImageUrl ? buildGuideCoverImageProxyPath(guide.slug) : null,
    hasCoverImage: Boolean(coverImageUrl),
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
