import type { Metadata } from "next";

import { AdminRecoveryHashRedirect } from "@/components/admin/login/admin-recovery-hash-redirect";
import { AnalyticsPageReady } from "@/components/layout/analytics-page-ready";
import { toHomePageSettings } from "@/components/villas/home/client-payload";
import { HomeBackNavigationScroll } from "@/components/villas/home/home-back-navigation-scroll";
import { HomePage } from "@/components/villas/home/page";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { getSiteSettings } from "@/lib/site-settings/server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import { resolveTikTokVillaLinks } from "@/lib/tiktok/villa-links";
import { fetchHouseListings } from "@/lib/villas/server";

import { getHomePageData } from "./server-data";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    absoluteTitle: true,
    canonicalPath: "/",
    settings,
    title: settings.seo.title,
  });
}

export default async function Page() {
  const homePageDataPromise = getHomePageData();
  const settingsPromise = getSiteSettings();
  const resolvedTikTokVideosPromise = settingsPromise.then(async ({ settings }) => {
    if (!settings.tiktok.videos.some((video) => video.houseId !== null)) {
      return resolveTikTokVillaLinks(settings.tiktok.videos, []);
    }

    try {
      return resolveTikTokVillaLinks(
        settings.tiktok.videos,
        await fetchHouseListings(),
      );
    } catch (error) {
      console.error("Unable to resolve TikTok villa links", error);
      return resolveTikTokVillaLinks(settings.tiktok.videos, []);
    }
  });
  const [
    settingsResult,
    contactSettingsResult,
    siteWebStyles,
    resolvedTikTokVideos,
    homePageData,
  ] = await Promise.all([
    settingsPromise,
    getSiteContactSettings(),
    getSiteWebStyles(),
    resolvedTikTokVideosPromise,
    homePageDataPromise,
  ]);
  const { settings } = settingsResult;
  const homePageSettings = toHomePageSettings(
    {
      ...settings,
      tiktok: {
        ...settings.tiktok,
        videos: resolvedTikTokVideos,
      },
    },
    contactSettingsResult.settings,
  );

  const jsonLd = buildHomeJsonLd(settings, contactSettingsResult.settings);

  return (
    <>
      <AdminRecoveryHashRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomePage
        customerReviews={homePageData.customerReviews}
        degradedSources={{
          ...homePageData.degradedSources,
          siteSettings: settingsResult.degraded || contactSettingsResult.degraded,
        }}
        filterSummary={homePageData.filterSummary}
        homeLayout={homePageData.homeLayout.items}
        initialGuides={homePageData.guides}
        initialHomeSections={homePageData.homeSections}
        settings={homePageSettings}
        villaCardStyle={siteWebStyles.houseCard.variant}
      />
      <AnalyticsPageReady pagePath="/" />
      <HomeBackNavigationScroll />
    </>
  );
}
