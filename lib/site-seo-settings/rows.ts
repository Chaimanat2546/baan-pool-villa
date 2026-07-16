import type { SiteSettingsRow } from "../site-settings/types";

export const SITE_SEO_PAGE_TYPES = [
  "global",
  "search",
  "guides",
  "villa_detail",
] as const;

export type SiteSeoPageType = (typeof SITE_SEO_PAGE_TYPES)[number];

export interface SiteSeoSettingsRow {
  page_type: SiteSeoPageType;
  settings: unknown;
}

type SeoPersistencePayload = Partial<SiteSettingsRow>;

export function mapSiteSeoRowsToLegacyProjection(
  rows: readonly SiteSeoSettingsRow[],
): Partial<SiteSettingsRow> {
  const projection: Partial<SiteSettingsRow> = {};

  for (const row of rows) {
    if (!isSettingsObject(row.settings)) {
      continue;
    }

    const settings = row.settings;

    switch (row.page_type) {
      case "global":
        projection.seo_title = settings.title as string | null | undefined;
        projection.seo_description = settings.description as
          | string
          | null
          | undefined;
        projection.seo_keywords = settings.keywords;
        projection.seo_og_image_url = settings.ogImageUrl as
          | string
          | null
          | undefined;
        projection.seo_og_image_alt = settings.ogImageAlt as
          | string
          | null
          | undefined;
        projection.seo_business_name = settings.businessName as
          | string
          | null
          | undefined;
        projection.seo_same_as_urls = settings.sameAsUrls;
        break;
      case "search":
        projection.search_seo_title = settings.title as
          | string
          | null
          | undefined;
        projection.search_seo_description = settings.description as
          | string
          | null
          | undefined;
        projection.search_seo_keywords = settings.keywords;
        projection.search_seo_og_image_url = settings.ogImageUrl as
          | string
          | null
          | undefined;
        projection.search_seo_og_image_alt = settings.ogImageAlt as
          | string
          | null
          | undefined;
        break;
      case "guides":
        projection.guides_seo_title = settings.title as
          | string
          | null
          | undefined;
        projection.guides_seo_description = settings.description as
          | string
          | null
          | undefined;
        projection.guides_seo_keywords = settings.keywords;
        projection.guides_seo_og_image_url = settings.ogImageUrl as
          | string
          | null
          | undefined;
        projection.guides_seo_og_image_alt = settings.ogImageAlt as
          | string
          | null
          | undefined;
        break;
      case "villa_detail":
        projection.villa_detail_seo_keywords = settings.keywords;
        break;
    }
  }

  return projection;
}

export function buildSiteSeoRows(
  payload: SeoPersistencePayload,
): SiteSeoSettingsRow[] {
  return [
    {
      page_type: "global",
      settings: {
        title: payload.seo_title,
        description: payload.seo_description,
        keywords: payload.seo_keywords,
        ogImageUrl: payload.seo_og_image_url,
        ogImageAlt: payload.seo_og_image_alt,
        businessName: payload.seo_business_name,
        sameAsUrls: payload.seo_same_as_urls,
      },
    },
    {
      page_type: "search",
      settings: {
        title: payload.search_seo_title,
        description: payload.search_seo_description,
        keywords: payload.search_seo_keywords,
        ogImageUrl: payload.search_seo_og_image_url,
        ogImageAlt: payload.search_seo_og_image_alt,
      },
    },
    {
      page_type: "guides",
      settings: {
        title: payload.guides_seo_title,
        description: payload.guides_seo_description,
        keywords: payload.guides_seo_keywords,
        ogImageUrl: payload.guides_seo_og_image_url,
        ogImageAlt: payload.guides_seo_og_image_alt,
      },
    },
    {
      page_type: "villa_detail",
      settings: { keywords: payload.villa_detail_seo_keywords },
    },
  ];
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
