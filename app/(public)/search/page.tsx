import type { Metadata } from "next";
import { Suspense } from "react";

import { getSearchPageData } from "@/components/villas/search/page-data";
import { SearchPage } from "@/components/villas/search/page";
import { buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    canonicalPath: "/search",
    section: "search",
    settings,
  });
}

type SearchPageRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toInitialSearchParams(
  params: Record<string, string | string[] | undefined>,
): string | undefined {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      searchParams.set(key, value);
    }
  }

  const serializedParams = searchParams.toString();

  return serializedParams || undefined;
}

export default async function Page({ searchParams }: SearchPageRouteProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { error, villas, meta } = await getSearchPageData(resolvedSearchParams);

  return (
    <Suspense fallback={null}>
      <SearchPage
        initialLoadError={error}
        initialVillas={villas}
        initialMeta={meta}
        initialSearchParams={toInitialSearchParams(resolvedSearchParams)}
      />
    </Suspense>
  );
}
