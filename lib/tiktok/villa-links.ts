import type { SiteTikTokVideoSettings } from "@/lib/site-settings/types";
import type { VillaListing } from "@/lib/villas/types";

export const TIKTOK_VILLA_SEARCH_LIMIT = 10;

export interface TikTokVillaOption {
  id: string;
  title: string;
}

type TikTokVideoWithVilla = SiteTikTokVideoSettings & {
  villa: TikTokVillaOption | null;
};

function toTikTokVillaOption(villa: Pick<VillaListing, "id" | "title">): TikTokVillaOption {
  return {
    id: villa.id,
    title: villa.title?.trim() || `บ้านพัก #${villa.id}`,
  };
}

export function normalizeTikTokVillaHouseId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  for (let index = 0; index < normalizedValue.length; index += 1) {
    const code = normalizedValue.charCodeAt(index);

    if (code < 48 || code > 57) {
      return null;
    }
  }

  return normalizedValue.charCodeAt(0) === 48 ? null : normalizedValue;
}

export function searchTikTokVillaOptions(
  villas: readonly VillaListing[],
  query: string,
): TikTokVillaOption[] {
  const needle = query.trim().toLocaleLowerCase();

  if (needle.length === 0) {
    return [];
  }

  return villas
    .filter((villa) =>
      villa.id.includes(needle) ||
      villa.title?.toLocaleLowerCase().includes(needle),
    )
    .slice(0, TIKTOK_VILLA_SEARCH_LIMIT)
    .map(toTikTokVillaOption);
}

export function resolveTikTokVillaLinks(
  videos: readonly SiteTikTokVideoSettings[],
  villas: readonly VillaListing[],
): TikTokVideoWithVilla[] {
  const villasById = new Map(
    villas.map((villa) => [villa.id, toTikTokVillaOption(villa)]),
  );

  return videos.map((video) => ({
    ...video,
    villa: video.houseId ? villasById.get(video.houseId) ?? null : null,
  }));
}

export function validateTikTokVideoHouseIds(
  videos: readonly Pick<SiteTikTokVideoSettings, "houseId">[],
  villas: readonly VillaListing[],
): string[] {
  const villaIds = new Set(villas.map((villa) => villa.id));
  const errors: string[] = [];

  for (const video of videos) {
    if (video.houseId && !villaIds.has(video.houseId)) {
      errors.push(`ไม่พบบ้านพักหมายเลข ${video.houseId}`);
    }
  }

  return [...new Set(errors)];
}
