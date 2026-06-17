import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { getResolvedHomeSections } from "@/lib/home-sections/server";
import { normalizeHouses } from "./normalize";
import type {
  RawHouse,
  RecommendedVillaSection,
  VillaDetailPayload,
  VillaListing,
} from "./types";

const HOUSE_LIST_URL = "https://www.devillegroups.com/api/json/getHouse_deville.json";
const DETAIL_URL = "https://deville-central.com/api/getAccommodation.php";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("External API returned invalid JSON");
  }
}

async function fetchHouseListingsFromApi(
  revalidate = CACHE_REVALIDATE_SECONDS.villaListings,
): Promise<VillaListing[]> {
  const response = await fetch(HOUSE_LIST_URL, {
    next: {
      revalidate,
      tags: [CACHE_TAGS.villaListings],
    },
  });

  if (!response.ok) {
    throw new Error(`House list API failed with ${response.status}`);
  }

  const data = await readJson<RawHouse[]>(response);
  return normalizeHouses(Array.isArray(data) ? data : []);
}

const fetchCachedHouseListings = unstable_cache(
  fetchHouseListingsFromApi,
  [CACHE_TAGS.villaListings],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.villaListings,
    tags: [CACHE_TAGS.villaListings],
  },
);

/**
 * Returns the cached public villa catalog used by home, search, guides, and
 * other listing consumers.
 *
 * @returns The normalized villa listings from the shared listing cache.
 */
export async function fetchHouseListings(): Promise<VillaListing[]> {
  return fetchCachedHouseListings();
}

/**
 * Uses the same listing normalization as the main catalog, but with the
 * sitemap request budget so sitemap generation can keep its own cache window.
 *
 * @returns The normalized villa listings using the sitemap cache window.
 */
export async function fetchHouseListingsForSitemap(): Promise<VillaListing[]> {
  return fetchHouseListingsFromApi(CACHE_REVALIDATE_SECONDS.sitemap);
}

/**
 * Finds a villa listing by id from the cached public catalog.
 *
 * @param id - The villa id from the public route or API request.
 * @returns The matching villa listing, or `null` when the id is unknown.
 */
export async function getListingById(id: string): Promise<VillaListing | null> {
  const listings = await fetchHouseListings();
  return listings.find((listing) => listing.id === id) ?? null;
}

/**
 * Resolves the listing first, then adds optional detail data when the upstream
 * detail API and bearer token are available.
 *
 * @param id - The villa id to resolve.
 * @param listings - An optional preloaded listing array to avoid a duplicate
 * catalog lookup.
 * @returns The combined listing/detail payload, or `null` when the villa does
 * not exist in the public catalog.
 */
export async function fetchVillaDetail(
  id: string,
  listings?: VillaListing[],
): Promise<VillaDetailPayload | null> {
  const listing =
    listings?.find((currentListing) => currentListing.id === id) ??
    (await getListingById(id));

  if (!listing) {
    return null;
  }

  const token = process.env.DEVILLE_BEARER_TOKEN;

  if (!token) {
    return {
      listing,
      detail: null,
      detailStatus: "missing_token",
    };
  }

  const url = new URL(DETAIL_URL);
  url.searchParams.set("hid", id);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: {
        revalidate: CACHE_REVALIDATE_SECONDS.villaDetail,
        tags: [CACHE_TAGS.villaDetails, CACHE_TAGS.villaDetail(id)],
      },
    });

    if (!response.ok) {
      return {
        listing,
        detail: null,
        detailStatus: "unavailable",
      };
    }

    return {
      listing,
      detail: await readJson<unknown>(response),
      detailStatus: "available",
    };
  } catch {
    return {
      listing,
      detail: null,
      detailStatus: "unavailable",
    };
  }
}

export type VillaPageData = {
  payload: VillaDetailPayload;
  recommendedSection: RecommendedVillaSection | null;
};

function toRecommendedVillaSection(
  sections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"],
): RecommendedVillaSection | null {
  // Villa detail pages only surface the first populated section so the
  // recommendation rail stays aligned with homepage merchandising order.
  const firstSection = sections.find((section) => section.villas.length > 0);

  if (!firstSection) {
    return null;
  }

  return {
    ...(firstSection.cta ? { cta: firstSection.cta } : {}),
    description: firstSection.description,
    title: firstSection.title,
    villas: firstSection.villas,
  };
}

/**
 * Combines villa detail data with the first resolved home-section
 * recommendation block used on the public detail page.
 *
 * @param id - The villa id to resolve for the public detail page.
 * @returns The page payload and recommendation block, or `null` when the villa
 * id is not found.
 */
export async function fetchVillaPageData(
  id: string,
): Promise<VillaPageData | null> {
  const listings = await fetchHouseListings();
  const payload = await fetchVillaDetail(id, listings);

  if (!payload) {
    return null;
  }

  const homeSections = await getResolvedHomeSections(listings);

  return {
    payload,
    recommendedSection: toRecommendedVillaSection(homeSections.sections),
  };
}
