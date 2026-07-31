import {
  ASSET_UPLOAD_FIELDS,
  readHeroSlideUploadFiles,
  readSiteSettingsUploadFiles,
  type UploadedAsset,
} from "./admin-asset-uploads";
import {
  getOptionalUpload,
  readStringArrayField,
  readStringField,
} from "./admin-form-fields";
import { DEFAULT_SITE_SETTINGS } from "./defaults";
import type {
  SiteAssetType,
  SiteImageSettings,
  SiteSettings,
  SiteSettingsDraft,
} from "./types";
import {
  normalizeSiteSettingsDraft,
  validateSiteSettingsDraft,
} from "./validation";

export const SITE_SETTINGS_SECTIONS = [
  "brand",
  "theme",
  "hero",
  "seo",
] as const;

export type SiteSettingsSection = (typeof SITE_SETTINGS_SECTIONS)[number];

type ThemeDraft = Pick<
  SiteSettingsDraft,
  | "primaryColor"
  | "accentColor"
  | "headerLinkColor"
  | "headerLinkHoverColor"
  | "footerLinkColor"
  | "footerLinkHoverColor"
  | "bankHighlightColor"
  | "bankAccountHighlightColor"
  | "bankNameHighlightColor"
  | "bankNumberHighlightColor"
>;

type SeoDraft = Pick<
  SiteSettingsDraft,
  | "seoTitle"
  | "seoDescription"
  | "seoKeywords"
  | "seoOgImageUrl"
  | "seoOgImageAlt"
  | "seoBusinessName"
  | "seoSameAsUrls"
  | "searchSeoTitle"
  | "searchSeoDescription"
  | "searchSeoKeywords"
  | "searchSeoOgImageUrl"
  | "searchSeoOgImageAlt"
  | "guidesSeoTitle"
  | "guidesSeoDescription"
  | "guidesSeoKeywords"
  | "guidesSeoOgImageUrl"
  | "guidesSeoOgImageAlt"
  | "villaDetailSeoKeywords"
>;

export interface SiteSettingsSectionDraftMap {
  brand: Pick<SiteSettingsDraft, "siteName" | "logoBackground">;
  theme: ThemeDraft;
  hero: { heroSlides: SiteImageSettings[] };
  seo: SeoDraft;
}

export interface SiteSettingsSectionResponseMap {
  brand: Pick<
    SiteSettings,
    "siteName" | "logoBackground" | "logoImage" | "faviconImage"
  >;
  theme: Pick<
    SiteSettings,
    | "primaryColor"
    | "accentColor"
    | "headerLinkColor"
    | "headerLinkHoverColor"
    | "footerLinkColor"
    | "footerLinkHoverColor"
    | "bankHighlightColor"
    | "bankAccountHighlightColor"
    | "bankNameHighlightColor"
    | "bankNumberHighlightColor"
  >;
  hero: Pick<SiteSettings, "heroImage" | "heroSlides">;
  seo: Pick<SiteSettings, "seo" | "pageSeo">;
}

const SECTION_SELECTS: Record<SiteSettingsSection, readonly string[]> = {
  brand: [
    "id,site_name,logo_background,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url",
    "id,site_name,logo_background,logo_image_path,logo_image_url",
  ],
  theme: [
    "id,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color",
    "id,primary_color,accent_color",
  ],
  hero: ["id,hero_image_path,hero_image_url,hero_image_alt,hero_slides", "id,hero_image_path,hero_image_url,hero_image_alt"],
  seo: [
    "id,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords",
    "id,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls",
  ],
};

const SECTION_FIELDS = {
  brand: ["siteName", "logoBackground"],
  theme: [
    "primaryColor",
    "accentColor",
    "headerLinkColor",
    "headerLinkHoverColor",
    "footerLinkColor",
    "footerLinkHoverColor",
    "bankHighlightColor",
    "bankAccountHighlightColor",
    "bankNameHighlightColor",
    "bankNumberHighlightColor",
  ],
  hero: [],
  seo: [
    "seoTitle",
    "seoDescription",
    "seoKeywords",
    "seoOgImageUrl",
    "seoOgImageAlt",
    "seoBusinessName",
    "seoSameAsUrls",
    "searchSeoTitle",
    "searchSeoDescription",
    "searchSeoKeywords",
    "searchSeoOgImageUrl",
    "searchSeoOgImageAlt",
    "guidesSeoTitle",
    "guidesSeoDescription",
    "guidesSeoKeywords",
    "guidesSeoOgImageUrl",
    "guidesSeoOgImageAlt",
    "villaDetailSeoKeywords",
  ],
} as const satisfies Record<SiteSettingsSection, readonly (keyof SiteSettingsDraft)[]>;

const SECTION_ASSET_TYPES = {
  brand: ["favicon", "logo"],
  theme: [],
  hero: ["hero"],
  seo: ["seo-og", "search-seo-og", "guides-seo-og"],
} satisfies Record<SiteSettingsSection, readonly SiteAssetType[]>;

const ARRAY_FIELDS = new Set<keyof SiteSettingsDraft>([
  "seoKeywords",
  "seoSameAsUrls",
  "searchSeoKeywords",
  "guidesSeoKeywords",
  "villaDetailSeoKeywords",
]);

function defaultDraft(): SiteSettingsDraft {
  return {
    siteName: DEFAULT_SITE_SETTINGS.siteName,
    primaryColor: DEFAULT_SITE_SETTINGS.primaryColor,
    accentColor: DEFAULT_SITE_SETTINGS.accentColor,
    headerLinkColor: DEFAULT_SITE_SETTINGS.headerLinkColor,
    headerLinkHoverColor: DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
    footerLinkColor: DEFAULT_SITE_SETTINGS.footerLinkColor,
    footerLinkHoverColor: DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
    bankHighlightColor: DEFAULT_SITE_SETTINGS.bankHighlightColor,
    bankAccountHighlightColor: DEFAULT_SITE_SETTINGS.bankAccountHighlightColor,
    bankNameHighlightColor: DEFAULT_SITE_SETTINGS.bankNameHighlightColor,
    bankNumberHighlightColor: DEFAULT_SITE_SETTINGS.bankNumberHighlightColor,
    logoBackground: DEFAULT_SITE_SETTINGS.logoBackground,
    heroImageAlt: DEFAULT_SITE_SETTINGS.heroImage.alt,
    seoTitle: DEFAULT_SITE_SETTINGS.seo.title,
    seoDescription: DEFAULT_SITE_SETTINGS.seo.description,
    seoKeywords: [...DEFAULT_SITE_SETTINGS.seo.keywords],
    seoOgImageUrl: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
    seoOgImageAlt: DEFAULT_SITE_SETTINGS.seo.ogImage.alt,
    seoBusinessName: DEFAULT_SITE_SETTINGS.seo.businessName,
    seoSameAsUrls: [...DEFAULT_SITE_SETTINGS.seo.sameAsUrls],
    searchSeoTitle: DEFAULT_SITE_SETTINGS.pageSeo.search.title,
    searchSeoDescription: DEFAULT_SITE_SETTINGS.pageSeo.search.description,
    searchSeoKeywords: [...DEFAULT_SITE_SETTINGS.pageSeo.search.keywords],
    searchSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.url,
    searchSeoOgImageAlt: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.alt,
    guidesSeoTitle: DEFAULT_SITE_SETTINGS.pageSeo.guides.title,
    guidesSeoDescription: DEFAULT_SITE_SETTINGS.pageSeo.guides.description,
    guidesSeoKeywords: [...DEFAULT_SITE_SETTINGS.pageSeo.guides.keywords],
    guidesSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.url,
    guidesSeoOgImageAlt: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.alt,
    villaDetailSeoKeywords: [
      ...DEFAULT_SITE_SETTINGS.pageSeo.villaDetail.keywords,
    ],
    tiktokAccountUrl: DEFAULT_SITE_SETTINGS.tiktok.accountUrl,
    tiktokVideoUrls: DEFAULT_SITE_SETTINGS.tiktok.videos.map(({ url }) => url),
  };
}

function parseHeroSlides(
  body: FormData | Record<string, unknown>,
):
  | { ok: true; draft: SiteSettingsSectionDraftMap["hero"] }
  | { ok: false; errors: string[] } {
  const rawValue = body instanceof FormData
    ? body.get("heroSlides")
    : body.heroSlides;
  let value: unknown = rawValue;

  if (typeof rawValue === "string") {
    try {
      value = JSON.parse(rawValue);
    } catch {
      return { ok: false, errors: ["Invalid heroSlides value."] };
    }
  }

  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    return {
      ok: false,
      errors: ["ต้องมีรูป Hero อย่างน้อย 1 และไม่เกิน 10 รูป"],
    };
  }

  const errors: string[] = [];
  const heroSlides: SiteImageSettings[] = [];

  value.forEach((item, slideIndex) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`ข้อมูลสไลด์ที่ ${slideIndex + 1} ไม่ถูกต้อง`);
      return;
    }

    const slide = item as Record<string, unknown>;
    if (
      typeof slide.alt !== "string" ||
      typeof slide.path !== "string" ||
      typeof slide.url !== "string"
    ) {
      errors.push(`ข้อมูลสไลด์ที่ ${slideIndex + 1} ไม่ถูกต้อง`);
      return;
    }

    const normalizedSlide = {
      alt: slide.alt.trim(),
      path: slide.path.trim(),
      url: slide.url.trim(),
    };
    if (!normalizedSlide.alt) {
      errors.push(`สไลด์ที่ ${slideIndex + 1} ต้องมีคำอธิบายรูป`);
    } else if (normalizedSlide.alt.length > 160) {
      errors.push(
        `คำอธิบายรูปสไลด์ที่ ${slideIndex + 1} ต้องไม่เกิน 160 ตัวอักษร`,
      );
    }

    const hasUpload = body instanceof FormData &&
      getOptionalUpload(body, `heroSlide-${slideIndex}`) !== null;
    if (!hasUpload && (!normalizedSlide.path || !normalizedSlide.url)) {
      errors.push(`สไลด์ที่ ${slideIndex + 1} ต้องมีรูปภาพ`);
    }

    heroSlides.push(normalizedSlide);
  });

  if (body instanceof FormData) {
    for (let slideIndex = value.length; slideIndex < 10; slideIndex += 1) {
      if (getOptionalUpload(body, `heroSlide-${slideIndex}`)) {
        errors.push(`ไฟล์ Hero สไลด์ที่ ${slideIndex + 1} ไม่มีข้อมูลสไลด์คู่กัน`);
      }
    }
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, draft: { heroSlides } };
}

export function isSiteSettingsSection(
  value: string,
): value is SiteSettingsSection {
  return SITE_SETTINGS_SECTIONS.some((section) => section === value);
}

export function getSiteSettingsSectionSelects(
  section: SiteSettingsSection,
): readonly string[] {
  return SECTION_SELECTS[section];
}

export function parseSiteSettingsSectionRequest<S extends SiteSettingsSection>(
  section: S,
  body: FormData | Record<string, unknown>,
):
  | { ok: true; draft: SiteSettingsSectionDraftMap[S] }
  | { ok: false; errors: string[] } {
  const fields = SECTION_FIELDS[section];
  const allowedKeys = new Set<string>(fields);

  if (section === "hero") {
    allowedKeys.add("heroSlides");
    for (let slideIndex = 0; slideIndex < 10; slideIndex += 1) {
      allowedKeys.add(`heroSlide-${slideIndex}`);
    }
  } else {
    for (const assetType of SECTION_ASSET_TYPES[section]) {
      const upload = ASSET_UPLOAD_FIELDS.find((field) => field.assetType === assetType);
      if (upload) {
        allowedKeys.add(upload.fieldName);
      }
    }
  }

  const bodyKeys = body instanceof FormData
    ? [...new Set(body.keys())]
    : Object.keys(body);
  const forbiddenKeys = bodyKeys.filter((key) => !allowedKeys.has(key));

  if (forbiddenKeys.length > 0) {
    return {
      ok: false,
      errors: forbiddenKeys.map(
        (key) => `Field "${key}" does not belong to the ${section} section.`,
      ),
    };
  }

  if (section === "hero") {
    return parseHeroSlides(body) as
      | { ok: true; draft: SiteSettingsSectionDraftMap[S] }
      | { ok: false; errors: string[] };
  }

  const draft = defaultDraft();

  if (body instanceof FormData) {
    for (const field of fields) {
      if (!body.has(field)) {
        continue;
      }
      if (ARRAY_FIELDS.has(field)) {
        (draft as unknown as Record<string, unknown>)[field] =
          readStringArrayField(body, field);
      } else {
        (draft as unknown as Record<string, unknown>)[field] =
          readStringField(body, field);
      }
    }
  } else {
    for (const field of fields) {
      if (!(field in body)) {
        continue;
      }
      const value = body[field];
      if (ARRAY_FIELDS.has(field)) {
        if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
          return { ok: false, errors: [`Invalid ${field} value.`] };
        }
      } else if (typeof value !== "string") {
        return { ok: false, errors: [`Invalid ${field} value.`] };
      }

      (draft as unknown as Record<string, unknown>)[field] = value;
    }
  }

  const normalizedDraft = normalizeSiteSettingsDraft(draft);
  const errors = validateSiteSettingsDraft(normalizedDraft);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    draft: Object.fromEntries(
      fields.map((field) => [field, normalizedDraft[field]]),
    ) as SiteSettingsSectionDraftMap[S],
  };
}

export function mapSiteSettingsSectionResponse<S extends SiteSettingsSection>(
  section: S,
  settings: SiteSettings,
): SiteSettingsSectionResponseMap[S] {
  const responses: SiteSettingsSectionResponseMap = {
    brand: {
      siteName: settings.siteName,
      logoBackground: settings.logoBackground,
      logoImage: settings.logoImage,
      faviconImage: settings.faviconImage,
    },
    theme: {
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
      headerLinkColor: settings.headerLinkColor,
      headerLinkHoverColor: settings.headerLinkHoverColor,
      footerLinkColor: settings.footerLinkColor,
      footerLinkHoverColor: settings.footerLinkHoverColor,
      bankHighlightColor: settings.bankHighlightColor,
      bankAccountHighlightColor: settings.bankAccountHighlightColor,
      bankNameHighlightColor: settings.bankNameHighlightColor,
      bankNumberHighlightColor: settings.bankNumberHighlightColor,
    },
    hero: {
      heroImage: settings.heroImage,
      heroSlides: settings.heroSlides,
    },
    seo: { seo: settings.seo, pageSeo: settings.pageSeo },
  };

  return responses[section];
}

export function getSectionUploadFiles(
  section: SiteSettingsSection,
  formData: FormData,
) {
  if (section === "hero") {
    return readHeroSlideUploadFiles(formData);
  }

  return readSiteSettingsUploadFiles(formData, SECTION_ASSET_TYPES[section]);
}

export function buildSiteSettingsSectionPayload<S extends SiteSettingsSection>(
  section: S,
  draft: SiteSettingsSectionDraftMap[S],
  currentSettings: SiteSettings,
  uploadedAssets: UploadedAsset[],
): Record<string, unknown> {
  const uploaded = (assetType: SiteAssetType) =>
    uploadedAssets.find((asset) => asset.assetType === assetType);

  switch (section) {
    case "brand": {
      const brand = draft as SiteSettingsSectionDraftMap["brand"];
      const logo = uploaded("logo");
      const favicon = uploaded("favicon");
      return {
        site_name: brand.siteName,
        logo_background: brand.logoBackground,
        logo_image_path: logo?.path ?? currentSettings.logoImage.path,
        logo_image_url: logo?.publicUrl ?? currentSettings.logoImage.url,
        favicon_image_path: favicon?.path ?? currentSettings.faviconImage.path,
        favicon_image_url: favicon?.publicUrl ?? currentSettings.faviconImage.url,
      };
    }
    case "theme": {
      const theme = draft as SiteSettingsSectionDraftMap["theme"];
      return {
        primary_color: theme.primaryColor,
        accent_color: theme.accentColor,
        header_link_color: theme.headerLinkColor,
        header_link_hover_color: theme.headerLinkHoverColor,
        footer_link_color: theme.footerLinkColor,
        footer_link_hover_color: theme.footerLinkHoverColor,
        bank_highlight_color: theme.bankHighlightColor,
        bank_account_highlight_color: theme.bankAccountHighlightColor,
        bank_name_highlight_color: theme.bankNameHighlightColor,
        bank_number_highlight_color: theme.bankNumberHighlightColor,
      };
    }
    case "hero": {
      const hero = draft as SiteSettingsSectionDraftMap["hero"];
      const heroSlides = hero.heroSlides.map((slide, slideIndex) => {
        const heroUpload = uploadedAssets.find(
          (asset) =>
            asset.assetType === "hero" &&
            asset.slideIndex === slideIndex,
        );

        return {
          alt: slide.alt,
          path: heroUpload?.path ?? slide.path,
          url: heroUpload?.publicUrl ?? slide.url,
        };
      });
      const firstSlide = heroSlides[0];
      return {
        hero_image_path: firstSlide.path,
        hero_image_url: firstSlide.url,
        hero_image_alt: firstSlide.alt,
        hero_slides: heroSlides,
      };
    }
    case "seo": {
      const seo = draft as SiteSettingsSectionDraftMap["seo"];
      return {
        seo_title: seo.seoTitle,
        seo_description: seo.seoDescription,
        seo_keywords: seo.seoKeywords,
        seo_og_image_url: uploaded("seo-og")?.publicUrl ?? seo.seoOgImageUrl,
        seo_og_image_alt: seo.seoOgImageAlt,
        seo_business_name: seo.seoBusinessName,
        seo_same_as_urls: seo.seoSameAsUrls,
        search_seo_title: seo.searchSeoTitle,
        search_seo_description: seo.searchSeoDescription,
        search_seo_keywords: seo.searchSeoKeywords,
        search_seo_og_image_url:
          uploaded("search-seo-og")?.publicUrl ?? seo.searchSeoOgImageUrl,
        search_seo_og_image_alt: seo.searchSeoOgImageAlt,
        guides_seo_title: seo.guidesSeoTitle,
        guides_seo_description: seo.guidesSeoDescription,
        guides_seo_keywords: seo.guidesSeoKeywords,
        guides_seo_og_image_url:
          uploaded("guides-seo-og")?.publicUrl ?? seo.guidesSeoOgImageUrl,
        guides_seo_og_image_alt: seo.guidesSeoOgImageAlt,
        villa_detail_seo_keywords: seo.villaDetailSeoKeywords,
      };
    }
  }
}
