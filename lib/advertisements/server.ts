import "server-only";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigCachedLoader } from "@/lib/home-sections/cache";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { ADVERTISEMENT_BUCKET, ADVERTISEMENT_IMAGE_LIMIT, type PublicAdvertisement } from "./types";
import {
  isAdvertisementId,
  isAdvertisementStoragePath,
  isRecord,
} from "./validation";

export function toPublicAdvertisement(
  row: unknown,
): PublicAdvertisement | null {
  if (
    !isRecord(row) ||
    !isAdvertisementId(row.id) ||
    row.is_active !== true ||
    typeof row.title !== "string" ||
    !row.title.trim() ||
    row.title.trim().length > 160
  )
    return null;
  const adId = row.id;
  const images = Array.isArray(row.site_advertisement_images)
    ? row.site_advertisement_images
    : [];
  const imageUrls = images
    .filter(
      (image): image is Record<string, unknown> =>
        isRecord(image) &&
        isAdvertisementId(image.id) &&
        isAdvertisementStoragePath(image.storage_path, adId) &&
        image.storage_path === `${adId}/${image.id}.webp` &&
        Number.isInteger(image.display_order),
    )
    .sort((a, b) => Number(a.display_order) - Number(b.display_order))
    .slice(0, ADVERTISEMENT_IMAGE_LIMIT)
    .map((image) => `/api/advertisements/images/${image.id}`);
  return imageUrls.length
    ? { id: adId, title: row.title.trim(), imageUrl: imageUrls[0], imageUrls }
    : null;
}
async function loadActiveAdvertisements(
  villaZone?: string,
): Promise<PublicAdvertisement[]> {
  const zone = villaZone?.trim().toLowerCase();
  let query = createHomeConfigClient()
    .from("site_advertisements")
    .select(
      "id,title,zone,is_active,sort_order,site_advertisement_images(id,storage_path,display_order)",
    )
    .eq("is_active", true);
  query = zone ? query.in("zone", [zone, "all"]) : query.eq("zone", "all");
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(8);
  if (error || !Array.isArray(data))
    throw new Error("Advertisements are unavailable");
  return data
    .map(toPublicAdvertisement)
    .filter((ad): ad is PublicAdvertisement => ad !== null);
}
export const getActiveAdvertisements = createHomeConfigCachedLoader(
  loadActiveAdvertisements,
  [CACHE_TAGS.advertisements, "site-owned-two-images-v1"],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.advertisements,
    tags: [CACHE_TAGS.advertisements],
  },
);
const loadImageSource = createHomeConfigCachedLoader(
  async (id: string): Promise<string | null> => {
    const supabase = createHomeConfigClient();
    const { data, error } = await supabase
      .from("site_advertisement_images")
      .select("id,storage_path,site_advertisements!inner(is_active)")
      .eq("id", id)
      .eq("site_advertisements.is_active", true)
      .maybeSingle();
    if (error) throw new Error("Advertisement image is unavailable");
    if (
      !data ||
      !isRecord(data.site_advertisements) ||
      data.site_advertisements.is_active !== true ||
      !isAdvertisementStoragePath(data.storage_path) ||
      !data.storage_path.endsWith(`/${id}.webp`)
    )
      return null;
    return supabase.storage
      .from(ADVERTISEMENT_BUCKET)
      .getPublicUrl(data.storage_path).data.publicUrl;
  },
  [CACHE_TAGS.advertisements, "image-site-owned-v1"],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.advertisements,
    tags: [CACHE_TAGS.advertisements],
  },
);
export async function getAdvertisementImageSource(id: string) {
  return isAdvertisementId(id) ? loadImageSource(id) : null;
}
