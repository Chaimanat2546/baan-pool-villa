import type { SiteSettings, SiteTikTokSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type { TikTokPreviewSettings } from "@/lib/tiktok/types";

const HOMEPAGE_TIKTOK_VIDEO_LIMIT = 6;

type TikTokSettings = SiteTikTokSettings | TikTokPreviewSettings;
type TikTokSectionVideo =
  | SiteTikTokSettings["videos"][number]
  | TikTokPreviewSettings["videos"][number];

export interface HomePageSettings {
  bank: SiteContactSettings["bank"];
  contact: SiteContactSettings["contact"];
  heroImage: SiteSettings["heroImage"];
  siteName: SiteSettings["siteName"];
  tiktok: SiteTikTokSettings;
}

export function selectHomeTikTokVideos(tiktok: TikTokSettings) {
  const seen = new Set<string>();
  const visibleVideos: TikTokSectionVideo[] = [];

  for (const video of tiktok.videos) {
    const trimmedVideoId = video.videoId.trim();

    if (!trimmedVideoId || seen.has(trimmedVideoId)) {
      continue;
    }

    seen.add(trimmedVideoId);
    visibleVideos.push({ ...video, videoId: trimmedVideoId });

    if (visibleVideos.length === HOMEPAGE_TIKTOK_VIDEO_LIMIT) {
      break;
    }
  }

  return visibleVideos;
}

export function toHomePageSettings(
  settings: SiteSettings,
  contactSettings: SiteContactSettings,
): HomePageSettings {
  return {
    bank: contactSettings.bank,
    contact: contactSettings.contact,
    heroImage: settings.heroImage,
    siteName: settings.siteName,
    tiktok: {
      accountUrl: settings.tiktok.accountUrl,
      videos: selectHomeTikTokVideos(settings.tiktok),
    },
  };
}
