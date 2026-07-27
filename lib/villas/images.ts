import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
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
export const VILLA_CARD_DISPLAY_IMAGE_MIN = 3;
export const VILLA_CARD_DISPLAY_IMAGE_MAX = 10;

type VillaCardImageConfigRow = {
  cover_image_alt?: unknown;
  cover_image_path?: unknown;
  cover_image_url?: unknown;
  house_id?: unknown;
  villa_card_image_items?: unknown;
};

type VillaCardImageItemRow = {
  image_id: unknown;
  sort_order: unknown;
};

type VillaCardImageConfig = {
  coverImage: VillaImage | null;
  imageIds: number[];
};

const VILLA_CARD_IMAGE_CONFIG_PAGE_KEY = "default";
const VILLA_COVER_OVERRIDE_IMAGE_ID = 0;

function normalizeNullableText(value: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

function normalizeCoverSelectValue(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getPreviewZoneKey(zone: string | null): string {
  const zoneKey = zone?.trim().toLowerCase();

  return zoneKey ? zoneKey : "uncategorized";
}

function isImageZone(image: VillaImage, zone: string): boolean {
  return getPreviewZoneKey(image.zone) === zone;
}

function isCoverZone(zone: string | null): boolean {
  const zoneKey = getPreviewZoneKey(zone);

  return (
    zoneKey === "cover" ||
    zoneKey === "\u0e23\u0e39\u0e1b\u0e1b\u0e01" ||
    zoneKey === "\u0e20\u0e32\u0e1e\u0e1b\u0e01"
  );
}

function getPreviewCoverPriority(image: VillaImage): number {
  if (isCoverZone(image.zone)) {
    return 2;
  }

  return image.isCover ? 1 : 0;
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
    const aCoverPriority = getPreviewCoverPriority(a);
    const bCoverPriority = getPreviewCoverPriority(b);

    if (aCoverPriority === bCoverPriority) {
      return aCoverPriority > 0 ? b.id - a.id : a.id - b.id;
    }

    return bCoverPriority - aCoverPriority;
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

function dedupeImagesById(images: VillaImage[]): VillaImage[] {
  const seenIds = new Set<number>();
  const selectedImages: VillaImage[] = [];

  for (const image of images) {
    if (seenIds.has(image.id)) {
      continue;
    }

    seenIds.add(image.id);
    selectedImages.push(image);
  }

  return selectedImages;
}

export function selectDefaultDisplayImages(images: VillaImage[]): VillaImage[] {
  const outsideImages = images
    .filter((image) => isImageZone(image, "outside"))
    .sort((a, b) => a.id - b.id)
    .slice(0, 5);
  const insideImages = images
    .filter((image) => isImageZone(image, "inside"))
    .sort((a, b) => a.id - b.id)
    .slice(0, 5);

  return dedupeImagesById([...outsideImages, ...insideImages]).slice(
    0,
    VILLA_CARD_DISPLAY_IMAGE_MAX,
  );
}

export function validateCustomDisplayImageIds(imageIds: number[]): number[] {
  if (imageIds.length < VILLA_CARD_DISPLAY_IMAGE_MIN) {
    throw new Error(`Select at least ${VILLA_CARD_DISPLAY_IMAGE_MIN} images`);
  }

  if (imageIds.length > VILLA_CARD_DISPLAY_IMAGE_MAX) {
    throw new Error(`Select at most ${VILLA_CARD_DISPLAY_IMAGE_MAX} images`);
  }

  const seenIds = new Set<number>();

  for (const id of imageIds) {
    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid image id");
    }

    if (seenIds.has(id)) {
      throw new Error("Duplicate image id");
    }

    seenIds.add(id);
  }

  return imageIds;
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

function getConfiguredImageIds(items: unknown): number[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const sortedItems = [...items]
    .map((item) => {
      const row = item as VillaCardImageItemRow;
      return {
        imageId: typeof row.image_id === "number" ? row.image_id : 0,
        sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.imageId) &&
        item.imageId > 0 &&
        Number.isInteger(item.sortOrder) &&
        item.sortOrder >= 1 &&
        item.sortOrder <= VILLA_CARD_DISPLAY_IMAGE_MAX,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return [...new Set(sortedItems.map((item) => item.imageId))].slice(
    0,
    VILLA_CARD_DISPLAY_IMAGE_MAX,
  );
}

function mapVillaCardImageConfig(
  row: VillaCardImageConfigRow | null,
): VillaCardImageConfig {
  if (!row) {
    return { coverImage: null, imageIds: [] };
  }

  return {
    coverImage: mapVillaCoverOverride(row),
    imageIds: getConfiguredImageIds(row.villa_card_image_items),
  };
}

function getImageNameFromPath(path: string): string | null {
  const name = path.split("/").pop()?.trim();

  return name || null;
}

function mapVillaCoverOverride(row: VillaCardImageConfigRow | null): VillaImage | null {
  if (!row) {
    return null;
  }

  const rawUrl =
    typeof row.cover_image_url === "string" ? row.cover_image_url.trim() : "";
  const imageUrl = normalizeImageUrl(rawUrl);

  if (!imageUrl) {
    return null;
  }

  const path =
    typeof row.cover_image_path === "string" ? row.cover_image_path.trim() : "";
  const alt =
    typeof row.cover_image_alt === "string" && row.cover_image_alt.trim()
      ? row.cover_image_alt.trim()
      : null;

  return {
    caption: alt,
    id: VILLA_COVER_OVERRIDE_IMAGE_ID,
    imageName: getImageNameFromPath(path),
    imageUrl,
    isCover: true,
    zone: "cover",
  };
}

function applyVillaCoverOverride(
  images: VillaImage[],
  coverImage: VillaImage | null,
): VillaImage[] {
  if (!coverImage) {
    return images;
  }

  return [
    coverImage,
    ...images.filter(
      (image) =>
        image.imageUrl !== coverImage.imageUrl &&
        !image.isCover &&
        !isCoverZone(image.zone),
    ),
  ];
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

async function fetchVillaImagesWithCoverOverrideFromSupabase(
  id: string,
  villaId: number,
): Promise<VillaImage[]> {
  const [images, config] = await Promise.all([
    fetchVillaImagesFromSupabase(villaId),
    fetchVillaCardImageConfig(id),
  ]);

  return applyVillaCoverOverride(images, config.coverImage);
}

async function fetchVillaCardImageConfig(id: string): Promise<VillaCardImageConfig> {
  try {
    const { data, error } = await createHomeConfigClient()
      .from("villa_card_image_configs")
      .select(
        "cover_image_path,cover_image_url,cover_image_alt,villa_card_image_items(image_id,sort_order)",
      )
      .eq("page_key", VILLA_CARD_IMAGE_CONFIG_PAGE_KEY)
      .eq("house_id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return { coverImage: null, imageIds: [] };
    }

    return mapVillaCardImageConfig(data as VillaCardImageConfigRow | null);
  } catch {
    return { coverImage: null, imageIds: [] };
  }
}

export async function fetchVillaCoverOverride(id: string): Promise<VillaImage | null> {
  parseVillaId(id);

  return (await fetchVillaCardImageConfig(id)).coverImage;
}

export async function fetchVillaCoverOverrideUrls(
  houseIds: readonly string[],
): Promise<Map<string, string>> {
  const validHouseIds = [...new Set(houseIds)]
    .map((id) => id.trim())
    .filter((id) => /^[1-9]\d*$/.test(id));

  if (validHouseIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await createHomeConfigClient()
      .from("villa_card_image_configs")
      .select("house_id,cover_image_url")
      .eq("page_key", VILLA_CARD_IMAGE_CONFIG_PAGE_KEY)
      .eq("is_active", true)
      .in("house_id", validHouseIds);

    if (error || !Array.isArray(data)) {
      return new Map();
    }

    const covers = new Map<string, string>();

    for (const row of data as VillaCardImageConfigRow[]) {
      const houseId =
        typeof row.house_id === "number"
          ? String(row.house_id)
          : typeof row.house_id === "string"
            ? row.house_id.trim()
            : "";
      const url =
        typeof row.cover_image_url === "string"
          ? normalizeImageUrl(row.cover_image_url)
          : null;

      if (houseId && url) {
        covers.set(houseId, url);
      }
    }

    return covers;
  } catch {
    return new Map();
  }
}

async function fetchVillaCardImageRowsFromSupabase(
  villaId: number,
): Promise<{ rows: SupabaseImageRow[]; supabaseUrl: string }> {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const queryImages = async (columns: string) =>
    supabase
      .from("images")
      .select(columns)
      .eq("property_id", villaId)
      .order("id", { ascending: true });

  let { data, error } = await queryImages(IMAGE_SELECT_COLUMNS);

  if (error && isMissingImageUrlColumnError(error)) {
    const legacyResponse = await queryImages(LEGACY_IMAGE_SELECT_COLUMNS);
    data = legacyResponse.data;
    error = legacyResponse.error;
  }

  if (error) {
    throw new Error(getSupabaseErrorText(error));
  }

  return {
    rows: (data ?? []) as unknown as SupabaseImageRow[],
    supabaseUrl,
  };
}

function selectRecommendedDisplayRows(rows: SupabaseImageRow[]): SupabaseImageRow[] {
  return rows
    .filter((row) => {
      const coverSelect = normalizeCoverSelectValue(row.cover_select);
      return coverSelect >= 1 && coverSelect <= VILLA_CARD_DISPLAY_IMAGE_MAX;
    })
    .sort((a, b) => {
      const coverDiff =
        normalizeCoverSelectValue(a.cover_select) -
        normalizeCoverSelectValue(b.cover_select);

      return coverDiff || a.id - b.id;
    })
    .slice(0, VILLA_CARD_DISPLAY_IMAGE_MAX);
}

function selectCustomDisplayImages(
  images: VillaImage[],
  imageIds: number[],
): VillaImage[] {
  const imagesById = new Map(images.map((image) => [image.id, image]));

  return imageIds
    .map((imageId) => imagesById.get(imageId))
    .filter((image): image is VillaImage => image !== undefined)
    .slice(0, VILLA_CARD_DISPLAY_IMAGE_MAX);
}

async function resolveDisplayImagesFromSupabase(
  id: string,
): Promise<VillaImage[]> {
  const villaId = parseVillaId(id);
  const [{ rows, supabaseUrl }, config] = await Promise.all([
    fetchVillaCardImageRowsFromSupabase(villaId),
    fetchVillaCardImageConfig(id),
  ]);
  const images = normalizeImageRows(rows, supabaseUrl);
  const defaultImages = config.coverImage
    ? [
        config.coverImage,
        ...selectDefaultDisplayImages(images).filter(
          (image) =>
            image.imageUrl !== config.coverImage?.imageUrl &&
            !isCoverZone(image.zone),
        ),
      ]
    : selectDefaultDisplayImages(images);
  const recommendedImages = applyVillaCoverOverride(
    normalizeImageRows(selectRecommendedDisplayRows(rows), supabaseUrl),
    config.coverImage,
  );

  const customImages = [
    ...(config.coverImage ? [config.coverImage] : []),
    ...selectCustomDisplayImages(images, config.imageIds).filter(
      (image) =>
        !config.coverImage ||
        (image.imageUrl !== config.coverImage.imageUrl && !isCoverZone(image.zone)),
    ),
  ];

  if (customImages.length >= VILLA_CARD_DISPLAY_IMAGE_MIN) {
    return customImages;
  }

  if (config.coverImage) {
    return defaultImages;
  }

  return recommendedImages.length > 0 ? recommendedImages : defaultImages;
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
    () => fetchVillaImagesWithCoverOverrideFromSupabase(id, villaId),
    [tag],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaImages,
      tags: [
        CACHE_TAGS.villaImages,
        CACHE_TAGS.villaCardImages,
        tag,
        CACHE_TAGS.villaCardImage(VILLA_CARD_IMAGE_CONFIG_PAGE_KEY, id),
      ],
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
    async () =>
      selectPreviewImages(
        await fetchVillaImagesWithCoverOverrideFromSupabase(id, villaId),
      ),
    [`${tag}:preview`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaImages,
      tags: [
        CACHE_TAGS.villaImages,
        CACHE_TAGS.villaCardImages,
        tag,
        CACHE_TAGS.villaCardImage(VILLA_CARD_IMAGE_CONFIG_PAGE_KEY, id),
      ],
    },
  );

  return getCachedVillaPreviewImages();
}

export async function resolveDisplayImages(id: string): Promise<VillaImage[]> {
  parseVillaId(id);
  const tag = CACHE_TAGS.villaImage(id);
  const cardTag = CACHE_TAGS.villaCardImage(VILLA_CARD_IMAGE_CONFIG_PAGE_KEY, id);
  const getCachedVillaCardImages = unstable_cache(
    () => resolveDisplayImagesFromSupabase(id),
    [cardTag],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.villaCardImages,
      tags: [CACHE_TAGS.villaCardImages, CACHE_TAGS.villaImages, tag, cardTag],
    },
  );

  return getCachedVillaCardImages();
}
