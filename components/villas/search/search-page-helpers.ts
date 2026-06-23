import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import type { VillaSortKey } from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

export const PAGE_SIZE = 12;

const SEARCH_LOAD_ERROR =
  "ไม่สามารถโหลดข้อมูลบ้านพักได้ กรุณาลองใหม่อีกครั้ง";

export const SORT_OPTIONS: { label: string; value: VillaSortKey }[] = [
  { label: "ค่าเริ่มต้น", value: "recommended" },
  { label: "ราคา ต่ำ-สูง", value: "price_asc" },
  { label: "ราคา สูง-ต่ำ", value: "price_desc" },
  { label: "จำนวนคน มาก-น้อย", value: "people_desc" },
  { label: "ห้องนอน มาก-น้อย", value: "bedrooms_desc" },
];

const ZONE_ALIASES: Record<string, string> = {
  จอมเทียน: "jomtien",
  พัทยา: "pattaya",
};

export interface SearchCatalogApiResponse {
  error?: string;
  hasMore?: boolean;
  items?: VillaListing[];
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface CatalogPageRequest {
  append?: boolean;
  filtersOverride?: VillaFilters;
  page: number;
  sortOverride?: VillaSortKey;
  villaIdOverride?: string;
}

export interface SmartSearchParseResult {
  filtersPatch: Partial<Pick<VillaFilters, "bedrooms" | "guests" | "maxPrice" | "zone">>;
  remainingQuery: string;
}

export function getSearchErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return SEARCH_LOAD_ERROR;
  }

  const message = error.message.trim().toLowerCase();

  if (
    message.startsWith("unable to load houses") ||
    message.startsWith("invalid house list response") ||
    message === "invalid house list payload"
  ) {
    return SEARCH_LOAD_ERROR;
  }

  return error.message;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function readSearchCatalogPayload(
  response: Response,
): Promise<SearchCatalogApiResponse> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Invalid house list response content type");
  }

  try {
    return (await response.json()) as SearchCatalogApiResponse;
  } catch {
    throw new Error("Invalid house list response JSON");
  }
}

export function isVillaSortKey(value: string | null): value is VillaSortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function getSortKeyFromSearchParams(
  searchParams: URLSearchParams,
): VillaSortKey {
  const requestedSortKey = searchParams.get("sort");

  return isVillaSortKey(requestedSortKey) ? requestedSortKey : "recommended";
}

export function getSearchConditionLabels(
  filters: VillaFilters,
  zones: { value: string; label: string }[],
): string[] {
  const zoneLabel =
    filters.zone === "all"
      ? "ทุกทำเล"
      : zones.find((zone) => zone.value === filters.zone)?.label ?? filters.zone;

  return [
    zoneLabel,
    `ผู้เข้าพัก ${filters.guests.toLocaleString("th-TH")} คน`,
    `ห้องนอน ${filters.bedrooms.toLocaleString("th-TH")} ห้อง`,
    `ราคาไม่เกิน ${filters.maxPrice.toLocaleString("th-TH")} บาท`,
    ...(filters.nearSeaOnly ? ["บ้านพักใกล้ทะเลไม่เกิน 2 กม."] : []),
    ...filters.amenities.map((amenity) => {
      const label =
        AMENITY_OPTIONS.find((option) => option.key === amenity)?.label ??
        amenity;
      return `สิ่งอำนวยความสะดวก: ${label}`;
    }),
  ];
}

function readLastNumber(matches: Iterable<RegExpMatchArray>): number | undefined {
  let value: number | undefined;

  for (const match of matches) {
    const nextValue = Number(match.slice(1).find(Boolean));

    if (Number.isFinite(nextValue)) {
      value = nextValue;
    }
  }

  return value;
}

export function parseSmartSearchQuery(
  query: string,
  zones: { value: string; label: string }[],
): SmartSearchParseResult {
  let remainingQuery = ` ${query.trim()} `;
  const filtersPatch: SmartSearchParseResult["filtersPatch"] = {};

  const guests = readLastNumber(
    remainingQuery.matchAll(/(?:พัก|ผู้ใหญ่)\s*(\d+)|(\d+)\s*คน/g),
  );
  const bedrooms = readLastNumber(remainingQuery.matchAll(/(\d+)\s*ห้อง(?:นอน)?/g));
  const maxPrice = readLastNumber(
    remainingQuery.matchAll(/(?:ไม่เกิน|ราคา)\s*(\d+)|(\d+)\s*บาท/g),
  );

  if (guests !== undefined) {
    filtersPatch.guests = guests;
    remainingQuery = remainingQuery.replace(/(?:พัก|ผู้ใหญ่)\s*\d+|\d+\s*คน/g, " ");
  }

  if (bedrooms !== undefined) {
    filtersPatch.bedrooms = bedrooms;
    remainingQuery = remainingQuery.replace(/\d+\s*ห้อง(?:นอน)?/g, " ");
  }

  if (maxPrice !== undefined) {
    filtersPatch.maxPrice = maxPrice;
    remainingQuery = remainingQuery.replace(/(?:ไม่เกิน|ราคา)\s*\d+|\d+\s*บาท/g, " ");
  }

  const normalizedRemainingQuery = remainingQuery.toLowerCase();
  const matchedZone = [...zones]
    .sort((left, right) => right.label.length - left.label.length)
    .find((zone) => {
      const label = zone.label.toLowerCase();
      const value = zone.value.toLowerCase();
      const aliases = Object.entries(ZONE_ALIASES)
        .filter(([, aliasValue]) => value.includes(aliasValue))
        .map(([alias]) => alias);

      return (
        normalizedRemainingQuery.includes(label) ||
        normalizedRemainingQuery.includes(value) ||
        aliases.some((alias) => normalizedRemainingQuery.includes(alias))
      );
    });
  const fallbackZoneAlias = Object.entries(ZONE_ALIASES).find(([alias]) =>
    normalizedRemainingQuery.includes(alias),
  );
  const matchedZoneValue = matchedZone?.value ?? fallbackZoneAlias?.[1];

  if (matchedZoneValue) {
    filtersPatch.zone = matchedZoneValue;
    const zoneAlias =
      Object.entries(ZONE_ALIASES).find(([, value]) =>
        matchedZoneValue.toLowerCase().includes(value),
      )?.[0] ?? fallbackZoneAlias?.[0] ?? "";
    for (const zoneTerm of [matchedZone?.label, matchedZone?.value, zoneAlias]) {
      if (zoneTerm) {
        remainingQuery = remainingQuery.replaceAll(zoneTerm, " ");
      }
    }
  }

  return {
    filtersPatch,
    remainingQuery: remainingQuery.trim().replace(/\s+/g, " "),
  };
}
