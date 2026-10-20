import "server-only";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigCachedLoader } from "@/lib/home-sections/cache";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { ADVERTISEMENT_BUCKET, ADVERTISEMENT_IMAGE_LIMIT, ADVERTISEMENT_PAGE_SIZE, type PublicAdvertisement, type PublicAdvertisementPage } from "./types";
import {
  isAdvertisementId,
  isAdvertisementStoragePath,
  isRecord,
  parseAdvertisementCursor,
  normalizeAdvertisementVillaZone,
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
  after?: string,
): Promise<PublicAdvertisementPage> {
  const zone = normalizeAdvertisementVillaZone(villaZone);
  let query = createHomeConfigClient()
    .from("site_advertisements")
    .select(
      "id,title,zone,is_active,sort_order,site_advertisement_images(id,storage_path,display_order)",
    )
    .eq("is_active", true);
  query = zone ? query.in("zone", [zone, "all"]) : query.eq("zone", "all");
  if (after) {
    const cursor = parseAdvertisementCursor(after);
    if (!cursor) throw new Error("Invalid advertisement cursor");
    query = query.or(`sort_order.gt.${cursor.order},and(sort_order.eq.${cursor.order},id.gt.${cursor.id})`);
  }
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(ADVERTISEMENT_PAGE_SIZE + 1);
  if (error || !Array.isArray(data))
    throw new Error("Advertisements are unavailable");
  const rows = data.slice(0, ADVERTISEMENT_PAGE_SIZE);
  const last = rows.at(-1);
  return {
    advertisements: rows.map(toPublicAdvertisement).filter((ad): ad is PublicAdvertisement => ad !== null),
    nextCursor: data.length > ADVERTISEMENT_PAGE_SIZE && last ? `${last.sort_order}:${last.id}` : null,
  };
}
export const getActiveAdvertisements = createHomeConfigCachedLoader(
  loadActiveAdvertisements,
  [CACHE_TAGS.advertisements, "site-owned-cursor-pages-v1"],
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
