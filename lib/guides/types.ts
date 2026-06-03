export type GuideStatus = "draft" | "published";

export interface GuideImage {
  alt: string;
  path: string;
  url: string;
}

export interface GuideDraft {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: GuideImage | null;
  contentBlocks: unknown[];
  tags: string[];
  recommendedHouseIds: string[];
  status: GuideStatus;
  isPinned: boolean;
  publishedAt: string | null;
}

export interface GuideSavePayload {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: GuideImage | null;
  contentBlocks: unknown[];
  tags: string[];
  recommendedHouseIds: string[];
  status: GuideStatus;
  isPinned: boolean;
  publishedAt: string | null;
}

export interface GuidePost extends GuideSavePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuidePostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_path: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  content_blocks: unknown;
  tags: unknown;
  recommended_house_ids: unknown;
  status: string | null;
  is_pinned: boolean | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuideAssetUploadRecord {
  createdAt: string;
  id: string;
  isCurrent: boolean;
  storageBucket: string;
  storagePath: string;
}
