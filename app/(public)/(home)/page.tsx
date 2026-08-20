import type { Metadata } from "next";
import { Suspense } from "react";

import {
  HomePage,
  HomePageContent,
  type HomePageDegradedSources,
} from "@/components/villas/home/page";
import { DeferredHomeContent } from "@/components/villas/home/deferred-home-content";
import { AdminRecoveryHashRedirect } from "@/components/admin/login/admin-recovery-hash-redirect";
import {
  toHomePageSettings,
  type HomePageSettings,
} from "@/components/villas/home/client-payload";
import { HeroSearchSkeleton } from "@/components/villas/home/hero-section-skeleton";
import { HeroSearch } from "@/components/villas/home/hero-search";
import { VillaRailSkeleton } from "@/components/villas/home/villa-rail-skeleton";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import {
  getInitialHomePageData,
  type InitialHomePageData,
} from "./server-data";

function HomeDeferredContentSkeleton() {
  return (
    <div className="pt-0 lg:pt-20">
      <VillaRailSkeleton />
      <VillaRailSkeleton cardCount={4} withCta={false} />
    </div>
  );
}

function HomeDeferredDegradedMarker({
  degradedSources,
}: {
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
}) {
  const degradedSourceNames = [
    degradedSources.guidePosts ? "guidePosts" : null,
    degradedSources.villaCatalog ? "villaCatalog" : null,
    degradedSources.homeSections ? "homeSections" : null,
  ].filter((source): source is string => source !== null);

  if (degradedSourceNames.length === 0) {
    return null;
  }

  return (
    <span
      hidden
      data-home-deferred-degraded="true"
      data-home-deferred-degraded-sources={degradedSourceNames.join(",")}
    />
  );
}

async function HomeInitialContent({
  initialHomeDataPromise,
  settings,
  villaCardStyle,
}: {
  initialHomeDataPromise: Promise<InitialHomePageData>;
  settings: HomePageSettings;
  villaCardStyle: Awaited<ReturnType<typeof getSiteWebStyles>>["houseCard"]["variant"];
}) {
  const initialPayload = await initialHomeDataPromise;

  return (
    <>
      <HomeDeferredDegradedMarker
        degradedSources={initialPayload.degradedSources}
      />
      <DeferredHomeContent
        criticalContent={
          <HomePageContent
            initialHomeSections={initialPayload.sections}
            criticalRailKey={initialPayload.criticalRailKey}
            homeLayout={
              initialPayload.criticalRailKey
                ? [
                    {
                      enabled: true,
                      key: initialPayload.criticalRailKey,
                      kind: "rail",
                    },
                  ]
                : []
            }
            settings={settings}
            villaCardStyle={villaCardStyle}
          />
        }
        criticalRailKey={initialPayload.criticalRailKey}
        homeLayout={initialPayload.layout}
        settings={{
          bank: settings.bank,
          contact: settings.contact,
          siteName: settings.siteName,
          tiktok: settings.tiktok,
        }}
        villaCardStyle={villaCardStyle}
      />
    </>
  );
}

async function HomeHeroSearch({
  initialHomeDataPromise,
}: {
  initialHomeDataPromise: Promise<InitialHomePageData>;
}) {
  const homePageData = await initialHomeDataPromise;

  return (
    <HeroSearch
      maxAvailablePrice={homePageData.filterSummary.maxAvailablePrice}
      zones={homePageData.filterSummary.zones}
    />
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    absoluteTitle: true,
    canonicalPath: "/",
    settings,
    title: settings.seo.title,
  });
}

/**
 * Render the homepage server component populated with site settings, guides, home sections, filter summary, and JSON-LD.
 *
 * Loads site settings and homepage data, builds JSON-LD for the site, injects the JSON-LD script into the page, and renders the HomePage component with resolved sections and filter summary.
 *
 * @returns A React element for the homepage containing the injected JSON-LD script and the HomePage component initialized with fetched data and settings.
 */
export default async function Page() {
  const initialHomeDataPromise = getInitialHomePageData();
  const [settingsResult, contactSettingsResult, siteWebStyles] = await Promise.all([
    getSiteSettings(),
    getSiteContactSettings(),
    getSiteWebStyles(),
  ]);
  const { settings } = settingsResult;
  const homePageSettings = toHomePageSettings(
    settings,
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
        degradedSources={{
          guidePosts: false,
          homeSections: false,
          siteSettings: settingsResult.degraded || contactSettingsResult.degraded,
          villaCatalog: false,
        }}
        heroSearch={
          <Suspense fallback={<HeroSearchSkeleton />}>
            <HomeHeroSearch initialHomeDataPromise={initialHomeDataPromise} />
          </Suspense>
        }
        settings={homePageSettings}
      >
        <Suspense fallback={<HomeDeferredContentSkeleton />}>
          <HomeInitialContent
            initialHomeDataPromise={initialHomeDataPromise}
            settings={homePageSettings}
            villaCardStyle={siteWebStyles.houseCard.variant}
          />
        </Suspense>
      </HomePage>
    </>
  );
}
