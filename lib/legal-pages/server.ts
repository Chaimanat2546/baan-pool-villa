import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { LEGAL_PAGE_DEFAULTS } from "./defaults";
import { LEGAL_PAGE_SLUGS, type LegalPage, type LegalPageRow, type LegalPageSlug } from "./types";
import { isLegalPageSlug, normalizeLegalPageRow } from "./validation";

const LEGAL_PAGE_SELECT =
  "id,slug,title,seo_description,content_blocks,status,published_at,created_at,updated_at";

async function fetchPublishedLegalPage(slug: LegalPageSlug): Promise<LegalPage> {
  const { data, error } = await createHomeConfigClient()
    .from("legal_pages")
    .select(LEGAL_PAGE_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Legal page config is unavailable");
  }

  if (!data) {
    return LEGAL_PAGE_DEFAULTS[slug];
  }

  const page = normalizeLegalPageRow(data as LegalPageRow);

  if (page.status !== "published") {
    return LEGAL_PAGE_DEFAULTS[slug];
  }

  return page;
}

async function fetchPublishedLegalPages(): Promise<LegalPage[]> {
  const publishedLegalPages = new Map<LegalPageSlug, LegalPage>();

  const { data, error } = await createHomeConfigClient()
    .from("legal_pages")
    .select(LEGAL_PAGE_SELECT)
    .eq("status", "published");

  if (error) {
    throw new Error("Legal page config is unavailable");
  }

  if (Array.isArray(data)) {
    for (const row of data) {
      if (!isLegalPageRowSlug(row)) {
        continue;
      }

      const page = normalizeLegalPageRow(row);

      if (page.status !== "published") {
        continue;
      }

      publishedLegalPages.set(page.slug, page);
    }
  }

  return LEGAL_PAGE_SLUGS.map((slug) =>
    publishedLegalPages.get(slug) ?? LEGAL_PAGE_DEFAULTS[slug],
  );
}

function isLegalPageRowSlug(row: unknown): row is LegalPageRow {
  return (
    typeof row === "object" &&
    row !== null &&
    isLegalPageSlug((row as { slug?: unknown }).slug)
  );
}

const getCachedPublishedLegalPages = unstable_cache(
  fetchPublishedLegalPages,
  [CACHE_TAGS.legalPages],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.legalPages,
    tags: [CACHE_TAGS.legalPages],
  },
);

type CachedLegalPageLoader = () => Promise<LegalPage>;

const cachedLegalPageLoaders = new Map<LegalPageSlug, CachedLegalPageLoader>();

function getCachedLegalPageLoader(slug: LegalPageSlug): CachedLegalPageLoader {
  const existingLoader = cachedLegalPageLoaders.get(slug);

  if (existingLoader) {
    return existingLoader;
  }

  const loader = unstable_cache(
    () => fetchPublishedLegalPage(slug),
    [CACHE_TAGS.legalPage(slug)],
    {
      revalidate: CACHE_REVALIDATE_SECONDS.legalPages,
      tags: [CACHE_TAGS.legalPages, CACHE_TAGS.legalPage(slug)],
    },
  );

  cachedLegalPageLoaders.set(slug, loader);
  return loader;
}

export async function getLegalPageBySlug(
  slug: LegalPageSlug,
): Promise<LegalPage> {
  try {
    return await getCachedLegalPageLoader(slug)();
  } catch {
    return LEGAL_PAGE_DEFAULTS[slug];
  }
}

export async function getPublishedLegalPages(): Promise<LegalPage[]> {
  try {
    return await getCachedPublishedLegalPages();
  } catch {
    return [LEGAL_PAGE_DEFAULTS.terms, LEGAL_PAGE_DEFAULTS.privacy];
  }
}
