import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchPage } from "@/components/villas/search/page";
import { buildPageMetadata, searchDescription } from "@/lib/seo";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

interface SearchRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/search",
  description: searchDescription,
  title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
});

async function getSearchPageData(): Promise<{
  error: string | null;
  villas: VillaListing[];
}> {
  try {
    return {
      error: null,
      villas: await fetchHouseListings(),
    };
  } catch {
    return {
      error: "โหลดข้อมูลบ้านพักไม่ได้",
      villas: [],
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
  const [{ error, villas }, routeSearchParams] = await Promise.all([
    getSearchPageData(),
    searchParams ?? Promise.resolve({}),
  ]);
  const serializedSearchParams = serializeSearchParams(routeSearchParams);

  return (
    <Suspense fallback={null}>
      <SearchPage
        key={serializedSearchParams}
        initialLoadError={error}
        initialSearchParams={serializedSearchParams}
        initialVillas={villas}
      />
    </Suspense>
  );
}
