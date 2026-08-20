import "server-only";

import { getHomepageCustomerReviewData } from "@/lib/customer-reviews/server";
import {
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  type HomepageCustomerReviewData,
} from "@/lib/customer-reviews/types";
import {
  selectHomeGuideSummaries,
  type PublicGuideSummary,
} from "@/lib/guides/public-dto";
import { getPublishedGuides } from "@/lib/guides/server";
import { buildDefaultHomePageLayout } from "@/lib/home-sections/layout";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
  type HomeSectionListingPlan,
} from "@/lib/home-sections/server";
import type {
  HomePageLayoutItem,
  HomePageLayoutResult,
  HomeSectionConfig,
  ResolvedHomeSection,
} from "@/lib/home-sections/types";
import { SEARCH_FACETS } from "@/lib/villas/search-options";
import {
  toPublicVillaListing,
  type PublicVillaListing,
} from "@/lib/villas/public-dto";
import {
  fetchActiveVillaZones,
  fetchHomeListings,
  withVillaCardGalleryPreviews,
} from "@/lib/villas/server";

export type PublicHomeSection = Omit<ResolvedHomeSection, "villas"> & {
  villas: PublicVillaListing[];
};

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

const HOME_FALLBACK_LISTING_LIMIT = 12;
const INITIAL_CRITICAL_RAIL_CARD_COUNT = 4;
const MAX_CRITICAL_RAIL_CARD_COUNT = 12;

export type HomePageData = {
  degradedSources: {
    guidePosts: boolean;
    homeSections: boolean;
    villaCatalog: boolean;
  };
  customerReviews: HomepageCustomerReviewData;
  guides: PublicGuideSummary[];
  homeLayout: HomePageLayoutResult;
  homeSections: PublicHomeSection[];
  filterSummary: FilterSummary;
};

export type DeferredHomePayload = {
  customerReviews: HomepageCustomerReviewData;
  degradedSources: HomePageData["degradedSources"];
  guides: PublicGuideSummary[];
  layout: HomePageLayoutItem[];
  sections: PublicHomeSection[];
};

export type InitialHomePayload = {
  criticalRailHasMore: boolean;
  criticalRailKey: string | null;
  degradedSources: HomePageData["degradedSources"];
  layout: HomePageLayoutItem[];
  sections: PublicHomeSection[];
};

export type InitialHomePageData = InitialHomePayload & {
  filterSummary: FilterSummary;
};

export type CriticalHomeRailBatch = {
  hasMore: boolean;
  nextOffset: number;
  villas: PublicVillaListing[];
};

export function getCriticalHomeRailKey(data: HomePageData): string | null {
  const nonEmptyRailKeys = new Set(
    data.homeSections
      .filter((section) => section.villas.length > 0)
      .map((section) => section.slug),
  );

  return (
    data.homeLayout.items.find(
      (item) =>
        item.enabled && item.kind === "rail" && nonEmptyRailKeys.has(item.key),
    )?.key ?? null
  );
}

export function buildInitialHomePayload(
  data: HomePageData,
): InitialHomePayload {
  const criticalRailKey = getCriticalHomeRailKey(data);
  const criticalSection = criticalRailKey
    ? data.homeSections.find((section) => section.slug === criticalRailKey)
    : undefined;

  return {
    criticalRailHasMore:
      (criticalSection?.villas.length ?? 0) > INITIAL_CRITICAL_RAIL_CARD_COUNT,
    criticalRailKey,
    degradedSources: { ...data.degradedSources },
    layout: data.homeLayout.items
      .filter((item) => item.enabled)
      .map((item) => ({ ...item })),
    sections: criticalSection
      ? [
          {
            ...criticalSection,
            villas: criticalSection.villas.slice(
              0,
              INITIAL_CRITICAL_RAIL_CARD_COUNT,
            ),
          },
        ]
      : [],
  };
}

export function buildDeferredHomePayload(
  data: HomePageData,
  criticalRailKey: string | null,
): DeferredHomePayload {
  const enabledLayoutItems = data.homeLayout.items.filter(
    (item) => item.enabled,
  );
  const enabledRailKeys = new Set(
    enabledLayoutItems.flatMap((item) =>
      item.kind === "rail" ? [item.key] : [],
    ),
  );
  const articlesEnabled = enabledLayoutItems.some(
    (item) => item.kind === "fixed" && item.key === "articles",
  );
  const customerReviewsEnabled = enabledLayoutItems.some(
    (item) => item.kind === "fixed" && item.key === "customer_reviews",
  );

  return {
    customerReviews: customerReviewsEnabled
      ? {
          ...data.customerReviews,
          images: data.customerReviews.images.map((image) => ({ ...image })),
        }
      : {
          images: [],
          layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
        },
    degradedSources: { ...data.degradedSources },
    guides: articlesEnabled
      ? data.guides.map((guide) => ({ ...guide, tags: [...guide.tags] }))
      : [],
    layout: enabledLayoutItems.filter(
      (item) => !(item.kind === "rail" && item.key === criticalRailKey),
    ),
    sections: data.homeSections
      .filter(
        (section) =>
          section.slug !== criticalRailKey && enabledRailKeys.has(section.slug),
      )
      .map((section) => ({
        ...section,
        ...(section.cta ? { cta: { ...section.cta } } : {}),
        villas: section.villas.map((villa) => ({ ...villa })),
      })),
  };
}

export async function getDeferredHomePayload(
  criticalRailKey: string | null,
): Promise<DeferredHomePayload> {
  const data = await loadHomePageData(false);

  return buildDeferredHomePayload(data, criticalRailKey);
}

function getConfigHouseIds(config: HomeSectionConfig): string[] {
  return config.items
    .filter((item) => item.isActive)
    .sort((left, right) => left.position - right.position)
    .map((item) => item.houseId);
}

function getConfigListingLimit(config: HomeSectionConfig): number {
  return Math.max(
    INITIAL_CRITICAL_RAIL_CARD_COUNT,
    Math.max(0, Math.trunc(config.sliceOffset)) +
      Math.max(1, Math.trunc(config.limitCount)),
  );
}

async function resolvePlanRail(
  plan: HomeSectionListingPlan,
  railKey: string,
): Promise<{
  degraded: boolean;
  section: ResolvedHomeSection | null;
}> {
  const config = plan.configs.find(
    (candidate) => candidate.isActive && candidate.slug === railKey,
  );
  const villas = await fetchHomeListings(
    config ? getConfigHouseIds(config) : [],
    config ? getConfigListingLimit(config) : HOME_FALLBACK_LISTING_LIMIT,
  );
  const result = config
    ? await getResolvedHomeSections(villas, [config], false)
    : await getResolvedHomeSections(
        villas,
        plan.configs,
        plan.layout.source === "fallback",
      );

  return {
    degraded: result.degraded,
    section:
      result.sections.find(
        (section) => section.slug === railKey && section.villas.length > 0,
      ) ?? null,
  };
}

async function resolveFirstPlanRail(plan: HomeSectionListingPlan): Promise<{
  degraded: boolean;
  railKey: string | null;
  section: ResolvedHomeSection | null;
}> {
  let degraded = plan.layout.degraded;

  for (const item of plan.layout.items) {
    if (!item.enabled || item.kind !== "rail") {
      continue;
    }

    const resolved = await resolvePlanRail(plan, item.key);
    degraded = degraded || resolved.degraded;

    if (resolved.section) {
      return { degraded, railKey: item.key, section: resolved.section };
    }
  }

  return { degraded, railKey: null, section: null };
}

async function toInitialPublicSection(
  section: ResolvedHomeSection | null,
): Promise<PublicHomeSection | null> {
  if (!section) {
    return null;
  }

  const villas = await withVillaCardGalleryPreviews(
    section.villas.slice(0, INITIAL_CRITICAL_RAIL_CARD_COUNT),
  );

  return {
    ...section,
    villas: villas.map(toPublicVillaListing),
  };
}

export async function getInitialHomePageData(): Promise<InitialHomePageData> {
  const zonesPromise = fetchActiveVillaZones().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const planResult = await getHomeSectionListingPlan(
    HOME_FALLBACK_LISTING_LIMIT,
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const plan =
    planResult.status === "fulfilled" ? planResult.value : null;
  let criticalRailKey: string | null = null;
  let section: ResolvedHomeSection | null = null;
  let homeSectionsDegraded = planResult.status === "rejected";
  let villaCatalogDegraded = false;
  let fallbackLayout: HomePageLayoutItem[] = [];

  if (plan) {
    try {
      const resolved = await resolveFirstPlanRail(plan);
      criticalRailKey = resolved.railKey;
      section = resolved.section;
      homeSectionsDegraded = resolved.degraded;
    } catch (error) {
      console.error("Unable to load homepage villa data", error);
      villaCatalogDegraded = true;
    }
  } else {
    try {
      const villas = await fetchHomeListings([], HOME_FALLBACK_LISTING_LIMIT);
      const resolved = await getResolvedHomeSections(villas);
      section = resolved.sections.find((candidate) => candidate.villas.length > 0) ?? null;
      criticalRailKey = section?.slug ?? null;
      fallbackLayout = buildDefaultHomePageLayout(
        resolved.sections.map((candidate) => candidate.slug),
      );
    } catch (error) {
      console.error("Unable to load fallback homepage villa data", error);
      villaCatalogDegraded = true;
    }
  }

  const [publicSection, zonesResult] = await Promise.all([
    toInitialPublicSection(section),
    zonesPromise,
  ]);

  if (zonesResult.status === "rejected") {
    console.error("Unable to load homepage villa zones", zonesResult.reason);
  }

  return {
    criticalRailHasMore:
      (section?.villas.length ?? 0) > INITIAL_CRITICAL_RAIL_CARD_COUNT,
    criticalRailKey: publicSection ? criticalRailKey : null,
    degradedSources: {
      guidePosts: false,
      homeSections: homeSectionsDegraded,
      villaCatalog: villaCatalogDegraded || zonesResult.status === "rejected",
    },
    filterSummary: {
      maxAvailablePrice: SEARCH_FACETS.maxPrice,
      zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
    },
    layout:
      plan?.layout.items.filter((item) => item.enabled).map((item) => ({ ...item })) ??
      fallbackLayout,
    sections: publicSection ? [publicSection] : [],
  };
}

export async function getCriticalHomeRailBatch(
  railKey: string,
  offset: number,
  excludedVillaIds: string[] = [],
): Promise<CriticalHomeRailBatch> {
  const nextOffset = Math.min(
    offset + INITIAL_CRITICAL_RAIL_CARD_COUNT,
    MAX_CRITICAL_RAIL_CARD_COUNT,
  );
  const plan = await getHomeSectionListingPlan(HOME_FALLBACK_LISTING_LIMIT);
  const layoutHasRail = plan.layout.items.some(
    (item) => item.enabled && item.kind === "rail" && item.key === railKey,
  );

  if (!layoutHasRail) {
    return { hasMore: false, nextOffset, villas: [] };
  }

  const { section } = await resolvePlanRail(plan, railKey);
  const boundedVillas = section?.villas.slice(0, MAX_CRITICAL_RAIL_CARD_COUNT) ?? [];
  const excludedVillaIdSet = new Set(excludedVillaIds);
  const continuationVillas =
    excludedVillaIdSet.size > 0
      ? boundedVillas.filter((villa) => !excludedVillaIdSet.has(villa.id))
      : boundedVillas.slice(offset);
  const batch = await withVillaCardGalleryPreviews(
    continuationVillas.slice(0, INITIAL_CRITICAL_RAIL_CARD_COUNT),
  );

  return {
    hasMore:
      nextOffset < MAX_CRITICAL_RAIL_CARD_COUNT &&
      batch.length < continuationVillas.length,
    nextOffset,
    villas: batch.map(toPublicVillaListing),
  };
}

async function loadHomePageData(includeZones: boolean): Promise<HomePageData> {
  const zonesResultPromise = includeZones
    ? fetchActiveVillaZones().then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ reason, status: "rejected" as const }),
      )
    : Promise.resolve({ status: "fulfilled" as const, value: [] });
  const guidesResultPromise = getPublishedGuides().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const customerReviewsResultPromise = getHomepageCustomerReviewData().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const homeSectionListingPlanResult = await getHomeSectionListingPlan(
    HOME_FALLBACK_LISTING_LIMIT,
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );

  const [villasResult, zonesResult] = await Promise.all([
    fetchHomeListings(
      homeSectionListingPlanResult.status === "fulfilled"
        ? homeSectionListingPlanResult.value.houseIds
        : [],
      homeSectionListingPlanResult.status === "fulfilled"
        ? homeSectionListingPlanResult.value.listingLimit
        : HOME_FALLBACK_LISTING_LIMIT,
    ).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ reason, status: "rejected" as const }),
    ),
    zonesResultPromise,
  ]);
  const guidesResult = await guidesResultPromise;
  const customerReviewsResult = await customerReviewsResultPromise;
  const guides =
    guidesResult.status === "fulfilled" ? guidesResult.value : [];
  const customerReviews =
    customerReviewsResult.status === "fulfilled"
      ? customerReviewsResult.value
      : {
          images: [],
          layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
        };

  if (guidesResult.status === "rejected") {
    console.error("Unable to load homepage guide posts", guidesResult.reason);
  }

  if (zonesResult.status === "rejected") {
    console.error("Unable to load homepage villa zones", zonesResult.reason);
  }

  if (villasResult.status === "rejected") {
    console.error("Unable to load homepage villa data", villasResult.reason);

    return {
      degradedSources: {
        guidePosts: guidesResult.status === "rejected",
        homeSections:
          homeSectionListingPlanResult.status === "rejected" ||
          homeSectionListingPlanResult.value.layout.degraded,
        villaCatalog: true,
      },
      customerReviews,
      guides: selectHomeGuideSummaries(guides),
      homeLayout:
        homeSectionListingPlanResult.status === "fulfilled"
          ? homeSectionListingPlanResult.value.layout
          : {
              degraded: true,
              items: buildDefaultHomePageLayout([]),
              source: "fallback",
            },
      homeSections: [],
      filterSummary: {
        maxAvailablePrice: SEARCH_FACETS.maxPrice,
        zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
      },
    };
  }

  const villas = villasResult.value;
  const homeSectionsResult =
    homeSectionListingPlanResult.status === "fulfilled"
      ? await getResolvedHomeSections(
          villas,
          homeSectionListingPlanResult.value.configs,
          homeSectionListingPlanResult.value.layout.source === "fallback",
        )
      : await getResolvedHomeSections(villas);
  const homeLayout =
    homeSectionListingPlanResult.status === "fulfilled"
      ? homeSectionListingPlanResult.value.layout
      : {
          degraded: true as const,
          items: buildDefaultHomePageLayout(
            homeSectionsResult.sections.map(({ slug }) => slug),
          ),
          source: "fallback" as const,
        };

  if (homeSectionsResult.degraded) {
    console.error(
      "Homepage rendered with fallback home sections",
      homeSectionsResult.fallbackReason,
    );
  }

  const homeSectionsWithPreviews = await Promise.all(
    homeSectionsResult.sections.map(async (section) => ({
      ...section,
      villas: [
        ...(await withVillaCardGalleryPreviews(section.villas.slice(0, 12))),
        ...section.villas.slice(12),
      ],
    })),
  );

  return {
    degradedSources: {
      guidePosts: guidesResult.status === "rejected",
      homeSections: homeSectionsResult.degraded || homeLayout.degraded,
      villaCatalog: zonesResult.status === "rejected",
    },
    customerReviews,
    guides: selectHomeGuideSummaries(guides),
    homeLayout,
    homeSections: homeSectionsWithPreviews.map((section) => ({
      ...section,
      villas: section.villas.map(toPublicVillaListing),
    })),
    filterSummary: {
      maxAvailablePrice: SEARCH_FACETS.maxPrice,
      zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
    },
  };
}

export async function getHomePageData(): Promise<HomePageData> {
  return loadHomePageData(true);
}
