import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "./cache-policy";

const IMMEDIATE_REVALIDATION = { expire: 0 } as const;

function revalidateTags(tags: string[]) {
  tags.forEach((tag) => {
    revalidateTag(tag, IMMEDIATE_REVALIDATION);
  });
}

function revalidatePaths(paths: string[]) {
  paths.forEach((path) => {
    revalidatePath(path);
  });
}

export function revalidateSiteSettingsCache() {
  revalidateTags([CACHE_TAGS.siteSettings]);
}

export function revalidateHomeSectionsCache() {
  revalidateTags([CACHE_TAGS.homeSections]);
}

export function revalidateGuideCache(slug?: string | null) {
  revalidateTags([
    CACHE_TAGS.guides,
    ...(slug ? [CACHE_TAGS.guide(slug)] : []),
  ]);
}

export function revalidateDetailLayoutCache() {
  revalidateTags([CACHE_TAGS.siteSettings]);
}

export function revalidateExternalVillaCache() {
  revalidateTags([CACHE_TAGS.villaListings, CACHE_TAGS.villaDetails]);
  revalidatePaths(["/", "/search", "/sitemap.xml"]);
  revalidatePath("/villas/[id]", "page");
}
