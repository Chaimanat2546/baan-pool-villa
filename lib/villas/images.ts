import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type { VillaImage } from "./types";

type SupabaseImageRow = {
  id: number;
  property_id: number;
  cover_select: number | null;
  image_name: string | null;
  image_url: string | null;
  caption: string | null;
  image_zone: string | null;
};

const DEFAULT_SUPABASE_URL = "https://rqizfiayvcbozlzuvbok.supabase.co";
const DEFAULT_IMAGE_PROXY_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/";

function normalizeNullableText(value: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error("Supabase publishable key is missing");
  }

  return { supabaseUrl, supabaseKey };
}

/**
 * Accepts absolute URLs or legacy relative paths and returns a normalized
 * absolute image URL.
 *
 * @param imageUrl - The raw image URL or relative path from Supabase data.
 * @param supabaseUrl - The base Supabase URL used to resolve relative paths.
 * @returns The normalized absolute image URL, or `null` when empty.
 */
export function normalizeImageUrl(
  imageUrl: string | null,
  supabaseUrl = DEFAULT_SUPABASE_URL,
): string | null {
  const trimmedUrl = imageUrl?.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    return new URL(trimmedUrl).toString();
  } catch {
    return new URL(trimmedUrl.replace(/^\/+/, ""), `${supabaseUrl}/`).toString();
  }
}

/**
 * Builds the proxy-backed display URL used for public villa gallery images.
 *
 * @param imageName - The stored Supabase image name.
 * @param proxyBaseUrl - The proxy base URL used for public image delivery.
 * @returns The proxy image URL, or `null` when the image name is empty.
 */
export function buildProxyImageUrl(
  imageName: string | null,
  proxyBaseUrl = DEFAULT_IMAGE_PROXY_BASE_URL,
): string | null {
  const trimmedImageName = imageName?.trim();

  if (!trimmedImageName) {
    return null;
  }

  return new URL(encodeURIComponent(trimmedImageName), proxyBaseUrl).toString();
}

/**
 * Prefers the image-name proxy path when possible so public image delivery can
 * stay behind the shared display proxy and edge cache.
 *
 * @param rows - The raw Supabase image rows for a villa.
 * @param supabaseUrl - The base Supabase URL used to resolve relative paths.
 * @param proxyBaseUrl - The proxy base URL used for public image delivery.
 * @returns The normalized villa images ready for public rendering.
 */
export function normalizeImageRows(
  rows: SupabaseImageRow[],
  supabaseUrl = DEFAULT_SUPABASE_URL,
  proxyBaseUrl = process.env.IMAGE_PROXY_BASE_URL ?? DEFAULT_IMAGE_PROXY_BASE_URL,
): VillaImage[] {
  return rows
    .map((row) => ({
      row,
      imageUrl:
        buildProxyImageUrl(row.image_name, proxyBaseUrl) ??
        normalizeImageUrl(row.image_url, supabaseUrl),
    }))
    .filter((item): item is { row: SupabaseImageRow; imageUrl: string } =>
      Boolean(item.imageUrl),
    )
    .map((row) => ({
      id: row.row.id,
      imageUrl: row.imageUrl,
      imageName: normalizeNullableText(row.row.image_name),
      caption: normalizeNullableText(row.row.caption),
      isCover: (row.row.cover_select ?? 0) > 0,
      zone: normalizeNullableText(row.row.image_zone),
    }));
}

/**
 * Rejects non-numeric or unsafe ids before they are used in Supabase queries.
 *
 * @param id - The villa id from the public route or API request.
 * @returns The parsed numeric villa id safe to use in Supabase queries.
 * @throws {Error} When the id is not a positive safe integer.
 */
export function parseVillaId(id: string): number {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new Error("Invalid villa id");
  }

  const villaId = Number(id);

  if (!Number.isSafeInteger(villaId)) {
    throw new Error("Invalid villa id");
  }

  return villaId;
}

async function fetchVillaImagesFromSupabase(
  id: string,
  villaId: number,
): Promise<VillaImage[]> {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("images")
    .select("id, property_id, cover_select, image_name, image_url, caption, image_zone")
    .eq("property_id", villaId)
    .order("cover_select", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeImageRows((data ?? []) as SupabaseImageRow[], supabaseUrl);
}

/**
 * Loads and caches the Supabase gallery rows for a single villa.
 *
 * @param id - The villa id from the public route or API request.
 * @returns The normalized gallery images for the requested villa.
 */
export async function fetchVillaImages(id: string): Promise<VillaImage[]> {
  const villaId = parseVillaId(id);
  const tag = CACHE_TAGS.villaImage(id);
  const getCachedVillaImages = unstable_cache(
    () => fetchVillaImagesFromSupabase(id, villaId),
    [tag],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaImages,
      tags: [CACHE_TAGS.villaImages, tag],
    },
  );

  return getCachedVillaImages();
}
