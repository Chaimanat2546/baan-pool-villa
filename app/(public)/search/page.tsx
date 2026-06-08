import type { Metadata } from "next";
import { Suspense } from "react";

import {
  getSearchPageData,
  serializeSearchParams,
} from "@/components/villas/search/page-data";
import { SearchPage } from "@/components/villas/search/page";
import { buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

interface SearchRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    canonicalPath: "/search",
    section: "search",
    settings,
  });
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
