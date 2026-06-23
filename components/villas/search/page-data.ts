import {
  filtersFromSearchParams,
} from "@/lib/villas/filters";
import { toPublicVillaListings } from "@/lib/villas/public-dto";
import { fetchVillaSearchFacets, fetchVillaSearchPage } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";
import { getSortKeyFromSearchParams } from "./search-page-helpers";

const PAGE_SIZE = 12;

export interface SearchPageInitialMeta {
  catalogComplete: boolean;
  maxPrice: number;
  resultCount: number;
  zones: { value: string; label: string }[];
}

export async function getSearchPageData(
  routeSearchParams: Record<string, string | string[] | undefined>,
): Promise<{
  error: string | null;
  villas: VillaListing[];
  meta: SearchPageInitialMeta;
}> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(routeSearchParams)) {
    if (typeof value === "string") {
      searchParams.set(key, value);
    }
  }

  try {
    const facets = await fetchVillaSearchFacets();
    const result = await fetchVillaSearchPage({
      facets,
      filters: filtersFromSearchParams(searchParams, facets.maxPrice),
      page: 1,
      pageSize: PAGE_SIZE,
      sortKey: getSortKeyFromSearchParams(searchParams),
      villaIdQuery: searchParams.get("id") ?? "",
    });

    return {
      error: null,
      villas: toPublicVillaListings(result.items),
      meta: {
        catalogComplete: false,
        maxPrice: facets.maxPrice,
        resultCount: result.total,
        zones: facets.zones,
      },
    };
  } catch {
    return {
      error: "ไม่สามารถโหลดรายการบ้านพักได้ในขณะนี้",
      villas: [],
      meta: {
        catalogComplete: false,
        maxPrice: 1000,
        resultCount: 0,
        zones: [],
      },
    };
  }
}

