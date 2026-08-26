import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type { TikTokPreviewSettings } from "@/lib/tiktok/types";
import type { TikTokVillaOption } from "@/lib/tiktok/villa-links";

const HOMEPAGE_TIKTOK_VIDEO_LIMIT = 15;

export interface HomeTikTokVideo {
  houseId?: string | null;
  url: string;
  videoId: string;
  villa?: TikTokVillaOption | null;
}

export interface HomeTikTokSettings {
  accountUrl: string;
  videos: readonly HomeTikTokVideo[];
}

type HomePageSettingsSource = Omit<SiteSettings, "tiktok"> & {
  tiktok: {
    accountUrl: string;
    videos: readonly HomeTikTokVideo[];
  };
};

export interface HomePageSettings {
  bank: SiteContactSettings["bank"];
  contact: SiteContactSettings["contact"];
  heroImage: SiteSettings["heroImage"];
  heroSlides: SiteSettings["heroSlides"];
  siteName: SiteSettings["siteName"];
  tiktok: HomeTikTokSettings;
}

type TikTokSectionVideo = HomeTikTokVideo | TikTokPreviewSettings["videos"][number];

export function selectHomeTikTokVideos(
  tiktok: HomeTikTokSettings,
): HomeTikTokVideo[];
export function selectHomeTikTokVideos(
  tiktok: TikTokPreviewSettings,
): TikTokPreviewSettings["videos"];
export function selectHomeTikTokVideos(
  tiktok: HomeTikTokSettings | TikTokPreviewSettings,
): TikTokSectionVideo[];
export function selectHomeTikTokVideos(
  tiktok: { videos: readonly TikTokSectionVideo[] },
) {
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
  settings: HomePageSettingsSource,
  contactSettings: SiteContactSettings,
): HomePageSettings {
  return {
    bank: contactSettings.bank,
    contact: contactSettings.contact,
    heroImage: settings.heroImage,
    heroSlides: settings.heroSlides,
    siteName: settings.siteName,
    tiktok: {
      accountUrl: settings.tiktok.accountUrl,
      videos: selectHomeTikTokVideos(settings.tiktok).map((video) => ({
        url: video.url,
        videoId: video.videoId,
        villa: video.villa
          ? { id: video.villa.id, title: video.villa.title }
          : null,
      })),
    },
  };
}
