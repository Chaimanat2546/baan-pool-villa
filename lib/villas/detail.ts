import { AMENITY_OPTIONS } from "./amenities";
import type { Amenity } from "./types";

export type VillaDetailFact = {
  label: string;
  value: string;
};

export type VillaDetailLocation = {
  address: string | null;
  seaDistance: string | null;
  mapUrl: string | null;
};

export type VillaDetailSection = {
  title: string;
  lines: string[];
};

export type VillaNearbyPlace = {
  name: string;
  zone: string | null;
  url: string | null;
};

export type VillaDetailVideo = {
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  watchUrl: string;
  label: string;
};

export interface VillaDetailContent {
  amenities: Amenity[];
  facts: VillaDetailFact[];
  location: VillaDetailLocation | null;
  nearbyPlaces: VillaNearbyPlace[];
  sections: VillaDetailSection[];
  videos: VillaDetailVideo[];
}

type DetailRecord = Record<string, unknown>;

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function isRecord(value: unknown): value is DetailRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: DetailRecord, key: string): string | null {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function formatTime(value: string | null): string | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return value;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatCurrency(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const amount = Number(value.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(amount) || amount <= 0) {
    return value;
  }

  return currencyFormatter.format(amount);
}

function normalizeLines(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
}

function readUrl(record: DetailRecord, key: string): string | null {
  const value = readString(record, key);

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const HTTP_URL_PREFIX = "http://";
const HTTPS_URL_PREFIX = "https://";

function isUrlBoundary(charCode: number): boolean {
  return (
    charCode === 34 ||
    charCode === 39 ||
    charCode === 60 ||
    charCode === 62 ||
    charCode === 160 ||
    charCode === 32 ||
    (charCode >= 9 && charCode <= 13)
  );
}

function isVideoUrlDelimiter(charCode: number): boolean {
  return charCode === 10 || charCode === 13 || charCode === 44;
}

function findNextVideoUrlStart(value: string, fromIndex: number): number {
  const httpIndex = value.indexOf(HTTP_URL_PREFIX, fromIndex);
  const httpsIndex = value.indexOf(HTTPS_URL_PREFIX, fromIndex);

  if (httpIndex === -1) {
    return httpsIndex;
  }

  if (httpsIndex === -1) {
    return httpIndex;
  }

  return Math.min(httpIndex, httpsIndex);
}

function extractVideoUrlCandidates(value: string): string[] {
  const candidates: string[] = [];
  let searchIndex = 0;

  while (searchIndex < value.length) {
    const startIndex = findNextVideoUrlStart(value, searchIndex);

    if (startIndex === -1) {
      break;
    }

    let endIndex = startIndex;

    while (
      endIndex < value.length &&
      !isUrlBoundary(value.charCodeAt(endIndex))
    ) {
      endIndex += 1;
    }

    candidates.push(value.slice(startIndex, endIndex));
    searchIndex = endIndex > startIndex ? endIndex : startIndex + 1;
  }

  return candidates;
}

function splitVideoUrlCandidates(value: string): string[] {
  const candidates: string[] = [];
  let startIndex = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (isVideoUrlDelimiter(value.charCodeAt(index))) {
      candidates.push(value.slice(startIndex, index));
      startIndex = index + 1;
    }
  }

  candidates.push(value.slice(startIndex));
  return candidates;
}

function trimTrailingVideoUrlPunctuation(value: string): string {
  let endIndex = value.length;

  while (endIndex > 0) {
    const charCode = value.charCodeAt(endIndex - 1);

    if (charCode !== 41 && charCode !== 44 && charCode !== 46) {
      break;
    }

    endIndex -= 1;
  }

  return value.slice(0, endIndex);
}

function normalizeVideoUrls(value: string | null): string[] {
  if (!value) {
    return [];
  }

  // Editors may paste one URL, comma-separated URLs, or mixed text with links,
  // so we try URL extraction first and fall back to delimiter splitting.
  const urlMatches = extractVideoUrlCandidates(value);
  const candidates =
    urlMatches.length > 0 ? urlMatches : splitVideoUrlCandidates(value);

  return Array.from(
    new Set(
      candidates
        .map((candidate) =>
          trimTrailingVideoUrlPunctuation(candidate.trim()),
        )
        .map(normalizeUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  );
}

function getYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const [prefix, videoId] = url.pathname.split("/").filter(Boolean);

    if (["embed", "shorts", "live"].includes(prefix)) {
      return videoId ?? null;
    }
  }

  return null;
}

function toVideoEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const youtubeId = getYouTubeVideoId(url);

    if (youtubeId) {
      return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
    }

    return null;
  } catch {
    return null;
  }
}

function toVideoThumbnailUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const youtubeId = getYouTubeVideoId(url);

    if (youtubeId) {
      return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    return null;
  } catch {
    return null;
  }
}

function toVideoWatchUrl(value: string): string {
  try {
    const url = new URL(value);
    const youtubeId = getYouTubeVideoId(url);

    if (youtubeId) {
      return `https://www.youtube.com/watch?v=${youtubeId}`;
    }

    return value;
  } catch {
    return value;
  }
}

function addFact(
  facts: VillaDetailFact[],
  label: string,
  value: string | null,
  suffix = "",
) {
  if (!value) {
    return;
  }

  facts.push({ label, value: `${value}${suffix}` });
}

function addSection(
  sections: VillaDetailSection[],
  title: string,
  lines: string[],
) {
  if (lines.length === 0) {
    return;
  }

  sections.push({ title, lines });
}

function buildPoolLines(detail: DetailRecord): string[] {
  const lines = normalizeLines(readString(detail, "h_swimmingpool"));
  const facilities = detail.facilities;

  if (isRecord(facilities) && readString(facilities, "swim_type") === "salt") {
    lines.push("สระระบบเกลือ");
  }

  return lines;
}

function buildPetPolicyLines(detail: DetailRecord): string[] {
  const facilities = detail.facilities;

  if (!isRecord(facilities)) {
    return [];
  }

  return normalizeLines(readString(facilities, "pet_detail"));
}

function buildNearbyPlaces(detail: DetailRecord): VillaNearbyPlace[] {
  const travel = detail.travel;

  if (!Array.isArray(travel)) {
    return [];
  }

  return travel
    .filter(isRecord)
    .map((place) => ({
      name: readString(place, "travel_loca_name"),
      zone: readString(place, "travel_zone_name"),
      url: readUrl(place, "travel_loca_url"),
    }))
    .filter(
      (place): place is VillaNearbyPlace => typeof place.name === "string",
    );
}

function buildVillaVideos(detail: DetailRecord): VillaDetailVideo[] {
  return normalizeVideoUrls(readString(detail, "h_videos")).map((url, index) => ({
    url,
    embedUrl: toVideoEmbedUrl(url),
    thumbnailUrl: toVideoThumbnailUrl(url),
    watchUrl: toVideoWatchUrl(url),
    label: `คลิปรีวิวบ้านพัก ${index + 1}`,
  }));
}

function isEnabledFacilityValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === "y" || normalizedValue === "yes" || normalizedValue === "true" || normalizedValue === "1";
}

function buildDetailAmenities(detail: DetailRecord): Amenity[] {
  const facilities = detail.facilities;

  if (!isRecord(facilities)) {
    return [];
  }

  const amenities = AMENITY_OPTIONS.filter((amenity) =>
    isEnabledFacilityValue(facilities[amenity.key]),
  );

  if (
    isEnabledFacilityValue(facilities.pets) &&
    !amenities.some((amenity) => amenity.key === "pet")
  ) {
    const petAmenity = AMENITY_OPTIONS.find((amenity) => amenity.key === "pet");

    if (petAmenity) {
      amenities.push(petAmenity);
    }
  }

  return amenities;
}

/**
 * Converts raw detail payloads into structured content blocks for the public
 * villa detail page without leaking upstream field names into the UI layer.
 *
 * @param detail - The raw villa detail payload returned by the detail API.
 * @returns Structured detail content ready for the public detail UI.
 */
export function buildVillaDetailContent(detail: unknown): VillaDetailContent {
  if (!isRecord(detail)) {
    return {
      amenities: [],
      facts: [],
      location: null,
      nearbyPlaces: [],
      sections: [],
      videos: [],
    };
  }

  const facts: VillaDetailFact[] = [];
  const sections: VillaDetailSection[] = [];
  const checkIn = formatTime(readString(detail, "h_time_checkin"));
  const checkOut = formatTime(readString(detail, "h_time_checkout"));
  const maxPeople = readString(detail, "h_people_max");
  const insurance = formatCurrency(readString(detail, "h_insurance"));
  const extraGuest = formatCurrency(readString(detail, "h_extra"));

  addFact(facts, "เช็คอิน", checkIn);
  addFact(facts, "เช็คเอาต์", checkOut);
  addFact(facts, "พักได้สูงสุด", maxPeople, maxPeople ? " คน" : "");
  addFact(facts, "ค่าประกัน", insurance);
  addFact(facts, "เสริมคน", extraGuest, extraGuest ? " / คน" : "");

  const address = readString(detail, "location") ?? readString(detail, "h_village");
  const seaDistance = readString(detail, "sea");
  const mapUrl = readUrl(detail, "map");
  const location =
    address || seaDistance || mapUrl ? { address, seaDistance, mapUrl } : null;

  addSection(sections, "รายละเอียดห้องนอน", normalizeLines(readString(detail, "h_bedroom_detail")));
  addSection(sections, "สระว่ายน้ำ", buildPoolLines(detail));
  addSection(sections, "ครัวและอุปกรณ์", normalizeLines(readString(detail, "h_kitchen_ware")));
  addSection(sections, "รายละเอียดเพิ่มเติม", normalizeLines(readString(detail, "h_moredetail")));
  addSection(sections, "ที่จอดรถ", normalizeLines(readString(detail, "h_parking")));
  addSection(sections, "ค่าใช้จ่ายเพิ่มเติม", normalizeLines(readString(detail, "h_additional_costs")));
  addSection(sections, "โปรโมชัน / ราคาแยกตามวัน", normalizeLines(readString(detail, "h_separate")));
  addSection(sections, "หมายเหตุ", normalizeLines(readString(detail, "h_alert")));
  addSection(sections, "กฎบ้านพัก", normalizeLines(readString(detail, "h_rule")));
  addSection(sections, "นโยบายสัตว์เลี้ยง", buildPetPolicyLines(detail));

  return {
    amenities: buildDetailAmenities(detail),
    facts,
    location,
    nearbyPlaces: buildNearbyPlaces(detail),
    sections,
    videos: buildVillaVideos(detail),
  };
}
