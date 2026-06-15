import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchHouseListings } from "@/lib/villas/server";
import {
  filterVillas,
  filterVillasById,
  filtersFromSearchParams,
  getMaxVillaPrice,
  getUniqueZones,
  sortVillas,
  type VillaSortKey,
} from "@/lib/villas/filters";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const MAX_PAGE_NUMBER = 1000;

const VILLA_SORT_KEYS = new Set<VillaSortKey>([
  "recommended",
  "price_asc",
  "price_desc",
  "people_desc",
  "bedrooms_desc",
]);

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function parseVillaSortKey(value: string | null): VillaSortKey {
  return value && VILLA_SORT_KEYS.has(value as VillaSortKey)
    ? (value as VillaSortKey)
    : "recommended";
}

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const requestUrl = new URL(request.url);
    const searchParams = requestUrl.searchParams;
    const villas = await fetchHouseListings();
    const maxPrice = Math.max(getMaxVillaPrice(villas), 1000);
    const filters = filtersFromSearchParams(searchParams, maxPrice);
    const sortKey = parseVillaSortKey(searchParams.get("sort"));
    const page = parseBoundedInteger(
      searchParams.get("page"),
      1,
      1,
      MAX_PAGE_NUMBER,
    );
    const pageSize = parseBoundedInteger(
      searchParams.get("limit"),
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    );
    const filteredItems = sortVillas(
      filterVillasById(filterVillas(villas, filters), searchParams.get("id") ?? ""),
      sortKey,
    );
    const offset = (page - 1) * pageSize;
    const items = filteredItems.slice(offset, offset + pageSize);

    return Response.json(
      {
        hasMore: offset + items.length < filteredItems.length,
        items,
        page,
        pageSize,
        total: filteredItems.length,
        facets: {
          maxPrice,
          zones: getUniqueZones(villas),
        },
      },
      {
        headers: {
          "Cache-Control": CACHE_HEADERS.villaListings,
        },
      },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load houses", error);
  }
}
