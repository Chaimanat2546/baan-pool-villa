import { CACHE_HEADERS } from "@/lib/cache-policy";
import {
  filtersFromSearchParams,
  type VillaSortKey,
} from "@/lib/villas/filters";
import { toPublicVillaListings } from "@/lib/villas/public-dto";
import { SEARCH_FACETS } from "@/lib/villas/search-options";
import { fetchVillaSearchPage } from "@/lib/villas/server";

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

export async function buildPublicHousesResponse(request: Request) {
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;
  const facets = SEARCH_FACETS;
  const filters = filtersFromSearchParams(searchParams, facets.maxPrice);
  const sortKey = parseVillaSortKey(searchParams.get("sort"));
  const page = parseBoundedInteger(searchParams.get("page"), 1, 1, MAX_PAGE_NUMBER);
  const pageSize = parseBoundedInteger(
    searchParams.get("limit"),
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );
  const result = await fetchVillaSearchPage({
    facets,
    filters,
    page,
    pageSize,
    sortKey,
    villaIdQuery: searchParams.get("id") ?? "",
  });

  return Response.json(
    {
      hasMore: result.hasMore,
      items: toPublicVillaListings(result.items),
      page,
      pageSize,
      total: result.total,
      facets: {
        maxPrice: facets.maxPrice,
        zones: facets.zones,
      },
    },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.villaListings,
      },
    },
  );
}
