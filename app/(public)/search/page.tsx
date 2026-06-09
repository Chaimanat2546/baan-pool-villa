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

export default async function Page() {
  const { error, villas, meta } = await getSearchPageData({});

  return (
    <Suspense fallback={null}>
      <SearchPage
        initialLoadError={error}
        initialVillas={villas}
        initialMeta={meta}
      />
    </Suspense>
  );
}
