import type { Metadata } from "next";
import { Suspense } from "react";

import {
  getSearchPageData,
  serializeSearchParams,
} from "@/components/villas/search/page-data";
import { SearchPage } from "@/components/villas/search/page";
import { buildPageMetadata, searchDescription } from "@/lib/seo";

interface SearchRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/search",
  description: searchDescription,
  title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
});

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
