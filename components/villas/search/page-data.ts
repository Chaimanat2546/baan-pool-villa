import { fetchHouseListings } from "@/lib/villas/server";
import {
  getMaxVillaPrice,
  getUniqueZones,
} from "@/lib/villas/filters";
import { toPublicVillaListings } from "@/lib/villas/public-dto";
import type { VillaListing } from "@/lib/villas/types";

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
  void routeSearchParams;

  try {
    const villas = await fetchHouseListings();
    const maxPrice = Math.max(getMaxVillaPrice(villas), 1000);

    return {
      error: null,
      villas: toPublicVillaListings(villas.slice(0, PAGE_SIZE)),
      meta: {
        catalogComplete: false,
        maxPrice,
        resultCount: villas.length,
        zones: getUniqueZones(villas),
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

