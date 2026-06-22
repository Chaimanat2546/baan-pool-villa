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
  image_url?: string | null;
  caption: string | null;
  image_zone: string | null;
};

const DEFAULT_SUPABASE_URL = "https://rqizfiayvcbozlzuvbok.supabase.co";
const DEFAULT_IMAGE_PROXY_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/";
const IMAGE_SELECT_COLUMNS =
  "id, property_id, cover_select, image_name, image_url, caption, image_zone";
const LEGACY_IMAGE_SELECT_COLUMNS =
  "id, property_id, cover_select, image_name, caption, image_zone";

function normalizeNullableText(value: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

function getPreviewZoneKey(zone: string | null): string {
  const zoneKey = zone?.trim().toLowerCase();

  return zoneKey ? zoneKey : "uncategorized";
}

function isCoverZone(zone: string | null): boolean {
  const zoneKey = getPreviewZoneKey(zone);

  return (
    zoneKey === "cover" ||
    zoneKey === "\u0e23\u0e39\u0e1b\u0e1b\u0e01" ||
    zoneKey === "\u0e20\u0e32\u0e1e\u0e1b\u0e01"
  );
}

function isPreviewCoverImage(image: VillaImage): boolean {
  return image.isCover || isCoverZone(image.zone);
}

function getBentoZonePriority(zone: string | null): number {
  const zoneKey = getPreviewZoneKey(zone);

  if (zoneKey === "outside") {
    return 0;
  }

  if (zoneKey === "inside") {
    return 1;
  }

  if (zoneKey === "review") {
    return 2;
  }

  return 3;
}

function selectPreviewImages(images: VillaImage[]): VillaImage[] {
  const seenUrls = new Set<string>();
  const sortedImages = [...images].sort((a, b) => {
    const aIsCover = isPreviewCoverImage(a);
    const bIsCover = isPreviewCoverImage(b);

    if (aIsCover === bIsCover) {
      return a.id - b.id;
    }

    return aIsCover ? -1 : 1;
  });
  const uniqueImages = sortedImages.filter((image) => {
    if (seenUrls.has(image.imageUrl)) {
      return false;
    }

    seenUrls.add(image.imageUrl);
    return true;
  });
  const [mainImage, ...sideImages] = uniqueImages;

  if (!mainImage) {
    return [];
  }

  return [
    mainImage,
    ...sideImages
      .map((image, index) => ({ image, index }))
      .sort((a, b) => {
        const priorityDiff =
          getBentoZonePriority(a.image.zone) - getBentoZonePriority(b.image.zone);

        return priorityDiff || a.index - b.index;
      })
      .slice(0, 3)
      .map(({ image }) => image),
  ];
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

function getSupabaseErrorText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return error instanceof Error ? error.message : "";
}

function isMissingImageUrlColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  const message = getSupabaseErrorText(error).toLowerCase();

  return (
    message.includes("image_url") &&
    (code === "42703" ||
      code === "PGRST204" ||
      message.includes("column") ||
      message.includes("schema cache"))
  );
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
 * Prefers the stored image URL so public image delivery can use next/image with
 * the configured loader. The image-name proxy path remains a legacy fallback
 * for rows that do not have an image URL.
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
        normalizeImageUrl(row.image_url ?? null, supabaseUrl) ??
        buildProxyImageUrl(row.image_name, proxyBaseUrl),
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
  limit?: number,
): Promise<VillaImage[]> {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const queryImages = async (columns: string) => {
    let query = supabase
      .from("images")
      .select(columns)
      .eq("property_id", villaId)
      .order("cover_select", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    return query;
  };

  let { data, error } = await queryImages(IMAGE_SELECT_COLUMNS);

  if (error && isMissingImageUrlColumnError(error)) {
    const legacyResponse = await queryImages(LEGACY_IMAGE_SELECT_COLUMNS);
    data = legacyResponse.data;
    error = legacyResponse.error;
  }

  if (error) {
    throw new Error(getSupabaseErrorText(error));
  }

  return normalizeImageRows((data ?? []) as unknown as SupabaseImageRow[], supabaseUrl);
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

/**
 * Loads only the first gallery rows needed to render the above-the-fold detail
 * preview without putting the complete gallery in the server render path.
 *
 * @param id - The villa id from the public route.
 * @returns Up to four normalized gallery images for the requested villa.
 */
export async function fetchVillaPreviewImages(id: string): Promise<VillaImage[]> {
  const villaId = parseVillaId(id);
  const tag = CACHE_TAGS.villaImage(id);
  const getCachedVillaPreviewImages = unstable_cache(
    async () => selectPreviewImages(await fetchVillaImagesFromSupabase(id, villaId)),
    [`${tag}:preview`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaImages,
      tags: [CACHE_TAGS.villaImages, tag],
    },
  );

  return getCachedVillaPreviewImages();
}
