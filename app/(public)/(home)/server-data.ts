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
import {
  buildDefaultHomePageLayout,
  getLeadingHomeRailKey,
} from "@/lib/home-sections/layout";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import type {
  FixedHomeSectionKey,
  HomePageLayoutItem,
  HomePageLayoutResult,
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
const HOME_RAIL_PREVIEW_LIMIT = 12;

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
  const data = await loadHomePageData("legacy-api");

  return buildDeferredHomePayload(data, criticalRailKey);
}

async function loadHomePageData(
  source: "document" | "legacy-api",
): Promise<HomePageData> {
  const zonesResultPromise = Promise.allSettled([
    source === "document" ? fetchActiveVillaZones() : [],
  ]);
  const [planResult] = await Promise.allSettled([
    getHomeSectionListingPlan(HOME_FALLBACK_LISTING_LIMIT),
  ]);
  const plan = planResult.status === "fulfilled" ? planResult.value : null;
  const shouldLoadFixedContent = (key: FixedHomeSectionKey) =>
    source === "legacy-api" ||
    plan === null ||
    plan.layout.items.some(
      (item) => item.enabled && item.kind === "fixed" && item.key === key,
    );
  const emptyCustomerReviews: HomepageCustomerReviewData = {
    images: [],
    layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  };

  const [villasResult, guidesResult, customerReviewsResult] =
    await Promise.allSettled([
      fetchHomeListings(
        plan?.houseIds ?? [],
        plan?.listingLimit ?? HOME_FALLBACK_LISTING_LIMIT,
      ),
      shouldLoadFixedContent("articles") ? getPublishedGuides() : [],
      shouldLoadFixedContent("customer_reviews")
        ? getHomepageCustomerReviewData()
        : emptyCustomerReviews,
    ]);
  const [zonesResult] = await zonesResultPromise;
  const guides =
    guidesResult.status === "fulfilled" ? guidesResult.value : [];
  const customerReviews =
    customerReviewsResult.status === "fulfilled"
      ? customerReviewsResult.value
      : emptyCustomerReviews;

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
        homeSections: plan === null || plan.layout.degraded,
        villaCatalog: true,
      },
      customerReviews,
      guides: selectHomeGuideSummaries(guides),
      homeLayout: plan?.layout ?? {
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
  const homeSectionsResult = plan
    ? await getResolvedHomeSections(
        villas,
        plan.configs,
        plan.layout.source === "fallback",
      )
    : await getResolvedHomeSections(villas);
  const homeLayout: HomePageLayoutResult = plan?.layout ?? {
    degraded: true,
    items: buildDefaultHomePageLayout(
      homeSectionsResult.sections.map(({ slug }) => slug),
    ),
    source: "fallback",
  };

  if (homeSectionsResult.degraded) {
    console.error(
      "Homepage rendered with fallback home sections",
      homeSectionsResult.fallbackReason,
    );
  }

  const nonEmptyRailKeys = new Set(
    homeSectionsResult.sections
      .filter(({ villas }) => villas.length > 0)
      .map(({ slug }) => slug),
  );
  const leadingRailKey = getLeadingHomeRailKey(
    homeLayout.items,
    (key) => nonEmptyRailKeys.has(key),
  );

  const homeSections = await Promise.all(
    homeSectionsResult.sections.map(async (section) => {
      let { villas } = section;

      if (source === "legacy-api" || section.slug === leadingRailKey) {
        try {
          const previews = await withVillaCardGalleryPreviews(
            villas.slice(0, HOME_RAIL_PREVIEW_LIMIT),
          );
          villas = [...previews, ...villas.slice(HOME_RAIL_PREVIEW_LIMIT)];
        } catch (error) {
          console.error("Unable to prepare homepage villa card previews", error);
        }
      }

      return { ...section, villas: villas.map(toPublicVillaListing) };
    }),
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
    homeSections,
    filterSummary: {
      maxAvailablePrice: SEARCH_FACETS.maxPrice,
      zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
    },
  };
}

export async function getHomePageData(): Promise<HomePageData> {
  return loadHomePageData("document");
}
