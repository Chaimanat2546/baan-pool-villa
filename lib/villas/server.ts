import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { fetchVillaPreviewImages, normalizeImageRows } from "./images";
import { AMENITY_OPTIONS } from "./amenities";
import { calculateCommission, getZoneLabel } from "./normalize";
import {
  toPublicVillaDetailPayload,
  toPublicVillaImages,
  type PublicVillaDetailPayload,
  type PublicVillaImage,
} from "./public-dto";
import type {
  Amenity,
  AmenityKey,
  VillaDetailPayload,
  VillaListing,
} from "./types";

type SupabaseFacilityJoin = {
  facilities:
    | { name: string | null; title: string | null }
    | { name: string | null; title: string | null }[]
    | null;
  value_boolean: boolean | null;
};

type SupabaseListingRow = {
  bathrooms: number | null;
  bedrooms: number | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  description?: string | null;
  extra_beds?: number | null;
  insurance_fee?: number | null;
  id?: string | null;
  listing_facilities?: SupabaseFacilityJoin[] | null;
  location_zone: string | null;
  max_guests: number | null;
  notes?: string | null;
  property_id: number | string | null;
  property_tags?: unknown;
  property_type: string | null;
  rating?: number | null;
  title?: string | null;
};

type SupabaseListingPriceRow = {
  deville_price: number | null;
  listing_id: string | null;
};

type SupabaseImageRow = {
  caption: string | null;
  cover_select: number | null;
  id: number;
  image_name: string | null;
  image_url?: string | null;
  image_zone: string | null;
  property_id: number;
};

const AMENITY_KEY_SET = new Set<AmenityKey>(
  AMENITY_OPTIONS.map((amenity) => amenity.key),
);
const DEFAULT_VILLA_SUPABASE_URL = "https://rqizfiayvcbozlzuvbok.supabase.co";
const DETAIL_URL = "https://deville-central.com/api/getAccommodation.php";
const COVER_IMAGE_PROPERTY_ID_CHUNK_SIZE = 50;
const LISTING_PRICE_ID_CHUNK_SIZE = 50;

const LISTING_SELECT_COLUMNS = `
  id,
  property_id,
  title,
  description,
  bedrooms,
  bathrooms,
  extra_beds,
  insurance_fee,
  checkin_time,
  checkout_time,
  sort_order,
  notes,
  location_zone,
  property_type,
  rating,
  max_guests,
  is_active,
  property_tags,
  listing_facilities (
    value_boolean,
    message,
    facilities (
      name,
      title
    )
  )
`;

function getVillaSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    DEFAULT_VILLA_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Villa Supabase config is missing");
  }

  return { supabaseUrl, supabaseKey };
}

function createVillaSupabaseClient() {
  const { supabaseUrl, supabaseKey } = getVillaSupabaseConfig();

  return {
    supabase: createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    supabaseUrl,
  };
}

type VillaSupabaseClient = ReturnType<typeof createVillaSupabaseClient>["supabase"];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("External API returned invalid JSON");
  }
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDisplayPrice(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? calculateCommission(value)
    : null;
}

function toAmenity(item: SupabaseFacilityJoin): Amenity | null {
  const facility = Array.isArray(item.facilities)
    ? item.facilities[0]
    : item.facilities;
  const key = facility?.name?.trim();

  if (item.value_boolean === false || !key || !AMENITY_KEY_SET.has(key as AmenityKey)) {
    return null;
  }

  return {
    key: key as AmenityKey,
    label: facility?.title?.trim() || key,
  };
}

function toVillaDetail(row: SupabaseListingRow): Record<string, unknown> {
  return {
    h_additional_costs: row.notes ?? null,
    h_extra: row.extra_beds ?? null,
    h_insurance: row.insurance_fee ?? null,
    h_moredetail: row.description ?? null,
    h_people_max: row.max_guests ?? null,
    h_time_checkin: row.checkin_time ?? null,
    h_time_checkout: row.checkout_time ?? null,
  };
}

function toVillaListing(
  row: SupabaseListingRow,
  coverImages: Map<string, string>,
  prices: Map<string, number>,
): VillaListing | null {
  const id = row.property_id === null ? "" : String(row.property_id).trim();

  if (!id) {
    return null;
  }

  const zone = row.location_zone?.trim() || "unknown";
  const listingId = row.id?.trim();

  return {
    id,
    title: row.title?.trim() || undefined,
    zone,
    zoneLabel: getZoneLabel(zone),
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    distanceToSea: "-",
    price: listingId ? (prices.get(listingId) ?? null) : null,
    people: toNumber(row.max_guests),
    coverImage: coverImages.get(id) ?? null,
    amenities: (row.listing_facilities ?? [])
      .map(toAmenity)
      .filter((amenity): amenity is Amenity => amenity !== null),
    poolType: row.property_type?.trim() || "-",
  };
}

function isCoverZone(zone: string | null): boolean {
  const key = zone?.trim().toLowerCase();

  return key === "cover" || key === "รูปปก" || key === "ภาพปก";
}

function sortCoverImageRows(rows: SupabaseImageRow[]): SupabaseImageRow[] {
  return [...rows].sort((a, b) => {
    const aCoverZone = isCoverZone(a.image_zone);
    const bCoverZone = isCoverZone(b.image_zone);

    if (aCoverZone !== bCoverZone) {
      return aCoverZone ? -1 : 1;
    }

    const coverDiff = (b.cover_select ?? 0) - (a.cover_select ?? 0);

    return coverDiff || a.id - b.id;
  });
}

function chunkPropertyIds(propertyIds: number[]): number[][] {
  const chunks: number[][] = [];

  for (let index = 0; index < propertyIds.length; index += COVER_IMAGE_PROPERTY_ID_CHUNK_SIZE) {
    chunks.push(propertyIds.slice(index, index + COVER_IMAGE_PROPERTY_ID_CHUNK_SIZE));
  }

  return chunks;
}

function chunkListingIds(listingIds: string[]): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < listingIds.length; index += LISTING_PRICE_ID_CHUNK_SIZE) {
    chunks.push(listingIds.slice(index, index + LISTING_PRICE_ID_CHUNK_SIZE));
  }

  return chunks;
}

async function fetchCoverImages(
  supabase: VillaSupabaseClient,
  supabaseUrl: string,
  propertyIds: number[],
): Promise<Map<string, string>> {
  if (propertyIds.length === 0) {
    return new Map();
  }

  const rows: SupabaseImageRow[] = [];

  for (const chunk of chunkPropertyIds(propertyIds)) {
    const { data, error } = await supabase
      .from("images")
      .select("id, property_id, cover_select, image_name, image_url, caption, image_zone")
      .in("property_id", chunk)
      .eq("image_zone", "cover")
      .order("cover_select", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Supabase images query failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as SupabaseImageRow[]));
  }

  const coverImages = new Map<string, string>();

  for (const row of sortCoverImageRows(rows)) {
    const key = String(row.property_id);

    if (!coverImages.has(key)) {
      const [image] = normalizeImageRows([row], supabaseUrl);

      if (image) {
        coverImages.set(key, image.imageUrl);
      }
    }
  }

  return coverImages;
}

async function fetchListingPrices(
  supabase: VillaSupabaseClient,
  listingIds: string[],
): Promise<Map<string, number>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const prices = new Map<string, number>();

  for (const chunk of chunkListingIds(listingIds)) {
    const { data, error } = await supabase
      .from("listing_prices")
      .select("listing_id, deville_price")
      .in("listing_id", chunk);

    if (error) {
      throw new Error(`Supabase listing_prices query failed: ${error.message}`);
    }

    for (const row of (data ?? []) as SupabaseListingPriceRow[]) {
      const listingId = row.listing_id?.trim();
      const price = toDisplayPrice(row.deville_price);

      if (!listingId || price === null) {
        continue;
      }

      const currentPrice = prices.get(listingId);

      if (currentPrice === undefined || price < currentPrice) {
        prices.set(listingId, price);
      }
    }
  }

  return prices;
}

function selectListings(supabase: VillaSupabaseClient) {
  return supabase
    .from("listings")
    .select(LISTING_SELECT_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
}

function selectListingDetail(supabase: VillaSupabaseClient, id: string) {
  return supabase
    .from("listings")
    .select(LISTING_SELECT_COLUMNS)
    .eq("is_active", true)
    .eq("property_id", toNumber(id))
    .maybeSingle();
}

async function fetchListingRows(): Promise<{
  rows: SupabaseListingRow[];
  supabase: VillaSupabaseClient;
  supabaseUrl: string;
}> {
  const { supabase, supabaseUrl } = createVillaSupabaseClient();
  const { data, error } = await selectListings(supabase);

  if (error) {
    throw new Error(`Supabase listings query failed: ${error.message}`);
  }

  return {
    rows: (data ?? []) as unknown as SupabaseListingRow[],
    supabase,
    supabaseUrl,
  };
}

async function fetchHouseListingsFromSupabase(): Promise<VillaListing[]> {
  const { rows, supabase, supabaseUrl } = await fetchListingRows();
  const propertyIds = rows
    .map((row) => toNumber(row.property_id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const listingIds = rows
    .map((row) => row.id?.trim())
    .filter((id): id is string => Boolean(id));
  const [coverImages, prices] = await Promise.all([
    fetchCoverImages(supabase, supabaseUrl, propertyIds),
    fetchListingPrices(supabase, listingIds),
  ]);

  return rows
    .map((row) => toVillaListing(row, coverImages, prices))
    .filter((listing): listing is VillaListing => listing !== null);
}

async function fetchSupabaseDetailFallback(
  id: string,
): Promise<Record<string, unknown> | null> {
  const { supabase } = createVillaSupabaseClient();
  const { data, error } = await selectListingDetail(supabase, id);

  if (error) {
    throw new Error(`Supabase listing detail query failed: ${error.message}`);
  }

  return data ? toVillaDetail(data as unknown as SupabaseListingRow) : null;
}

async function fetchVillaDetailFromSources(
  id: string,
  listing: VillaListing,
): Promise<VillaDetailPayload> {
  const tag = CACHE_TAGS.villaDetail(id);
  const getCachedVillaDetail = unstable_cache(
    async (): Promise<Omit<VillaDetailPayload, "listing">> => {
      const token = process.env.DEVILLE_BEARER_TOKEN?.trim();

      if (!token) {
        return {
          detail: await fetchSupabaseDetailFallback(id),
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
        });

        if (response.ok) {
          return {
            detail: await readJson<unknown>(response),
            detailStatus: "available",
          };
        }
      } catch {
        // fall back to the Supabase detail row below
      }

      return {
        detail: await fetchSupabaseDetailFallback(id),
        detailStatus: "unavailable",
      };
    },
    [tag],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaDetail,
      tags: [CACHE_TAGS.villaDetails, tag],
    },
  );

  try {
    return {
      listing,
      ...(await getCachedVillaDetail()),
    };
  } catch {
    return {
      listing,
      detail: null,
      detailStatus: "unavailable",
    };
  }
}

const fetchCachedHouseListings = unstable_cache(
  fetchHouseListingsFromSupabase,
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
  return fetchHouseListingsFromSupabase();
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
 * Resolves the listing first, then adds Deville Central detail data with the
 * Supabase listing row as a conservative fallback.
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

  return fetchVillaDetailFromSources(id, listing);
}

export type VillaPageData = {
  initialGalleryImages: PublicVillaImage[];
  payload: PublicVillaDetailPayload;
  recommendedSection: null;
};

/**
 * Combines villa detail data with the initial gallery preview used on the
 * public detail page.
 *
 * @param id - The villa id to resolve for the public detail page.
 * @returns The page payload, or `null` when the villa id is not found.
 */
export async function fetchVillaPageData(
  id: string,
): Promise<VillaPageData | null> {
  const listings = await fetchHouseListings();
  const payload = await fetchVillaDetail(id, listings);

  if (!payload) {
    return null;
  }

  const initialGalleryImages = await fetchVillaPreviewImages(id).catch(
    (error: unknown) => {
      console.error("Unable to load villa detail initial gallery images", error);
      return [];
    },
  );

  return {
    initialGalleryImages: toPublicVillaImages(id, initialGalleryImages.slice(0, 4)),
    payload: toPublicVillaDetailPayload(payload),
    recommendedSection: null,
  };
}
