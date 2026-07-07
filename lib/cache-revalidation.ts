import "server-only";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "./cache-policy";
import {
  HTML_CACHE_VERSION_GROUPS,
  bumpHtmlEdgeCacheVersions,
} from "./html-edge-cache-version";

const IMMEDIATE_REVALIDATION = { expire: 0 } as const;
const VILLA_CARD_IMAGE_CONFIG_PAGE_KEY = "default";

function revalidateTags(tags: string[]) {
  tags.forEach((tag) => {
    revalidateTag(tag, IMMEDIATE_REVALIDATION);
  });
}

export async function revalidateSiteSettingsCache() {
  revalidateTags([CACHE_TAGS.siteSettings]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.siteSettings]);
}

export async function revalidateHomeSectionsCache() {
  revalidateTags([CACHE_TAGS.homeSections]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.homeSections]);
}

export async function revalidateVillaCardImagesCache(id?: string | null) {
  revalidateTags([
    CACHE_TAGS.villaCardImages,
    ...(id
      ? [CACHE_TAGS.villaCardImage(VILLA_CARD_IMAGE_CONFIG_PAGE_KEY, id)]
      : []),
  ]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.villaImages]);
}

export async function revalidateGuideCache(slug?: string | null) {
  revalidateTags([
    CACHE_TAGS.guides,
    ...(slug ? [CACHE_TAGS.guide(slug)] : []),
  ]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.guides]);
}

export async function revalidateLegalPageCache(slug?: string | null) {
  revalidateTags([
    CACHE_TAGS.legalPages,
    ...(slug ? [CACHE_TAGS.legalPage(slug)] : []),
  ]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.legalPages]);
}

export async function revalidateDetailLayoutCache() {
  revalidateTags([CACHE_TAGS.siteSettings]);
  await bumpHtmlEdgeCacheVersions([HTML_CACHE_VERSION_GROUPS.detailLayout]);
}

export async function revalidateExternalVillaCache() {
  revalidateTags([
    CACHE_TAGS.villaListings,
    CACHE_TAGS.villaDetails,
    CACHE_TAGS.villaCardImages,
    CACHE_TAGS.villaImages,
  ]);
  await bumpHtmlEdgeCacheVersions([
    HTML_CACHE_VERSION_GROUPS.villaListings,
    HTML_CACHE_VERSION_GROUPS.villaDetails,
    HTML_CACHE_VERSION_GROUPS.villaImages,
  ]);
}
