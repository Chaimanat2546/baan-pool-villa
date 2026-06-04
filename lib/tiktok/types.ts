import type { SiteTikTokVideoSettings } from "@/lib/site-settings/types";

export interface TikTokVideoPreview extends SiteTikTokVideoSettings {
  authorName: string;
  thumbnailUrl: string;
  title: string;
}

export interface TikTokPreviewSettings {
  accountUrl: string;
  videos: TikTokVideoPreview[];
}
