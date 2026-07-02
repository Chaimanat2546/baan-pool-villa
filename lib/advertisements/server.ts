import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { buildAdvertisementImageUrl } from "./image-url";
import type { PublicAdvertisement } from "./types";

type AdvertisementImageRow = {
  created_at: unknown;
  image_name: unknown;
  image_order: unknown;
};

type AdvertisementRow = {
  advertisement_images: unknown;
  id: unknown;
  is_active: unknown;
  title: unknown;
};

const DEFAULT_ADVERTISEMENT_SUPABASE_URL =
  "https://rqizfiayvcbozlzuvbok.supabase.co";
const ADVERTISEMENT_LIMIT = 8;
const ADVERTISEMENT_SELECT =
  "id,title,is_active,advertisement_images(image_name,image_order,created_at)";

function getAdvertisementSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    DEFAULT_ADVERTISEMENT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error("Advertisement Supabase config is missing");
  }

  return { supabaseKey, supabaseUrl };
}

function createAdvertisementSupabaseClient() {
  const { supabaseKey, supabaseUrl } = getAdvertisementSupabaseConfig();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function toOrder(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function toImageRows(value: unknown): AdvertisementImageRow[] {
  return Array.isArray(value) ? (value as AdvertisementImageRow[]) : [];
}

function getImageUrls(
  advertisementId: string,
  images: AdvertisementImageRow[],
): string[] {
  const sortedImages = [...images].sort((a, b) => {
    const orderDiff = toOrder(a.image_order) - toOrder(b.image_order);

    if (orderDiff !== 0) {
      return orderDiff;
    }

    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });

  const imageUrls: string[] = [];

  for (const image of sortedImages) {
    const imageUrl = buildAdvertisementImageUrl({
      advertisementId,
      imageName: image.image_name,
    });

    if (imageUrl && !imageUrls.includes(imageUrl)) {
      imageUrls.push(imageUrl);
    }
  }

  return imageUrls;
}

export function toPublicAdvertisement(
  row: AdvertisementRow,
): PublicAdvertisement | null {
  if (
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    row.is_active !== true
  ) {
    return null;
  }

  const title = row.title.trim();
  const imageUrls = getImageUrls(row.id, toImageRows(row.advertisement_images));
  const imageUrl = imageUrls[0];

  if (!title || !imageUrl) {
    return null;
  }

  return {
    id: row.id,
    imageUrl,
    imageUrls,
    title,
  };
}

async function fetchActiveAdvertisements(): Promise<PublicAdvertisement[]> {
  const { data, error } = await createAdvertisementSupabaseClient()
    .from("advertisements")
    .select(ADVERTISEMENT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    throw new Error("Advertisements are unavailable");
  }

  return (data as AdvertisementRow[])
    .map(toPublicAdvertisement)
    .filter((ad): ad is PublicAdvertisement => ad !== null)
    .slice(0, ADVERTISEMENT_LIMIT);
}

const fetchCachedActiveAdvertisements = unstable_cache(
  fetchActiveAdvertisements,
  [CACHE_TAGS.advertisements],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.advertisements,
    tags: [CACHE_TAGS.advertisements],
  },
);

export async function getActiveAdvertisements(): Promise<PublicAdvertisement[]> {
  return fetchCachedActiveAdvertisements();
}
