import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchPage } from "@/components/villas/search/page";
import { buildPageMetadata, searchDescription } from "@/lib/seo";
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
import type { VillaListing } from "@/lib/villas/types";

interface SearchRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/search",
  description: searchDescription,
  title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
});

const PAGE_SIZE = 12;

export interface SearchPageInitialMeta {
  catalogComplete: boolean;
  maxPrice: number;
  resultCount: number;
  zones: Array<{ value: string; label: string }>;
}

function isVillaSortKey(value: string | null): value is VillaSortKey {
  return (
    value === "recommended" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "people_desc" ||
    value === "bedrooms_desc"
  );
}

async function getSearchPageData(
  routeSearchParams: Record<string, string | string[] | undefined>,
): Promise<{
  error: string | null;
  villas: VillaListing[];
  meta: SearchPageInitialMeta;
}> {
  const serialized = serializeSearchParams(routeSearchParams);
  const searchParams = new URLSearchParams(serialized);

  try {
    const villas = await fetchHouseListings();
    const maxPrice = Math.max(getMaxVillaPrice(villas), 1000);
    const filters = filtersFromSearchParams(searchParams, maxPrice);
    const villaIdQuery = searchParams.get("id") ?? "";
    const requestedSort = searchParams.get("sort");
    const sortKey = isVillaSortKey(requestedSort) ? requestedSort : "recommended";
    const filteredAndSorted = sortVillas(
      filterVillasById(filterVillas(villas, filters), villaIdQuery),
      sortKey,
    );

    return {
      error: null,
      villas: filteredAndSorted.slice(0, PAGE_SIZE),
      meta: {
        catalogComplete: false,
        maxPrice,
        resultCount: filteredAndSorted.length,
        zones: getUniqueZones(villas),
      },
    };
  } catch {
    return {
      error: "ไม่สามารถโหลดรายการบ้านพักได้ในขณะนี้",
      villas: [],
      meta: {
        catalogComplete: true,
        maxPrice: 1000,
        resultCount: 0,
        zones: [],
      },
    };
  }
}

function serializeSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        params.append(key, item);
      });
      return;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  });

  return params.toString();
}

export default async function Page({ searchParams }: SearchRouteProps) {
  const routeSearchParams = await (searchParams ?? Promise.resolve({}));
  const { error, villas, meta } = await getSearchPageData(routeSearchParams);
  const serializedSearchParams = serializeSearchParams(routeSearchParams);

  return (
    <Suspense fallback={null}>
      <SearchPage
        key={serializedSearchParams}
        initialLoadError={error}
        initialSearchParams={serializedSearchParams}
        initialVillas={villas}
        initialMeta={meta}
      />
    </Suspense>
  );
}
