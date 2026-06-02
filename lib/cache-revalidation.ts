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
  revalidatePaths(["/", "/search"]);
}

export function revalidateHomeSectionsCache() {
  revalidateTags([CACHE_TAGS.homeSections]);
  revalidatePaths(["/"]);
}

export function revalidateDetailLayoutCache() {
  revalidateTags([CACHE_TAGS.siteSettings]);
  revalidatePath("/villas/[id]", "page");
}

export function revalidateExternalVillaCache() {
  revalidateTags([CACHE_TAGS.villaListings, CACHE_TAGS.villaDetails]);
  revalidatePaths(["/", "/search", "/sitemap.xml"]);
  revalidatePath("/villas/[id]", "page");
}
