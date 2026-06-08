import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import type { VillaListing } from "@/lib/villas/types";
import type { GuidePost, GuidePostRow } from "./types";
import { createSlugFromTitle, normalizeGuidePostRow } from "./validation";

const GUIDE_POST_SELECT =
  "id,slug,title,excerpt,cover_image_path,cover_image_url,cover_image_alt,content_blocks,tags,recommended_house_ids,status,is_pinned,published_at,created_at,updated_at";

function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function fetchPublishedGuideRows(): Promise<GuidePost[]> {
  const { data, error } = await createHomeConfigClient()
    .from("guide_posts")
    .select(GUIDE_POST_SELECT)
    .eq("status", "published")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    throw new Error("Guide posts config is unavailable");
  }

  return (data as GuidePostRow[]).map(normalizeGuidePostRow);
}

const fetchCachedPublishedGuides = unstable_cache(
  fetchPublishedGuideRows,
  [CACHE_TAGS.guides],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.guides,
    tags: [CACHE_TAGS.guides],
  },
);

export async function getPublishedGuides(): Promise<GuidePost[]> {
  return fetchCachedPublishedGuides();
}

export async function getGuideBySlug(slug: string): Promise<GuidePost | null> {
  const normalizedSlug = createSlugFromTitle(decodeSlugParam(slug));
  const fetchCachedGuide = unstable_cache(
    async (): Promise<GuidePost | null> => {
      const { data, error } = await createHomeConfigClient()
        .from("guide_posts")
        .select(GUIDE_POST_SELECT)
        .eq("status", "published")
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (error) {
        throw new Error("Guide posts config is unavailable");
      }

      if (!data) {
        return null;
      }

      return normalizeGuidePostRow(data as GuidePostRow);
    },
    [CACHE_TAGS.guide(normalizedSlug)],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.guides,
      tags: [CACHE_TAGS.guides, CACHE_TAGS.guide(normalizedSlug)],
    },
  );

  return fetchCachedGuide();
}

export function resolveGuideRecommendedVillas(
  houseIds: string[],
  villas: VillaListing[],
): VillaListing[] {
  const villasById = new Map(villas.map((villa) => [villa.id, villa]));

  return houseIds
    .map((houseId) => villasById.get(houseId))
    .filter((villa): villa is VillaListing => villa !== undefined);
}
