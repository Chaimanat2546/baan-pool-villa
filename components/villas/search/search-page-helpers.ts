import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import type { VillaSortKey } from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

export const PAGE_SIZE = 12;

const SEARCH_LOAD_ERROR =
  "ไม่สามารถโหลดข้อมูลบ้านพักได้ กรุณาลองใหม่อีกครั้ง";

export const SORT_OPTIONS: { label: string; value: VillaSortKey }[] = [
  { label: "แนะนำ", value: "recommended" },
  { label: "ราคา ต่ำ-สูง", value: "price_asc" },
  { label: "ราคา สูง-ต่ำ", value: "price_desc" },
  { label: "จำนวนคน มาก-น้อย", value: "people_desc" },
  { label: "ห้องนอน มาก-น้อย", value: "bedrooms_desc" },
];

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
