import {
  ASSET_UPLOAD_FIELDS,
  readSiteSettingsUploadFiles,
  type UploadedAsset,
} from "./admin-asset-uploads";
import {
  readPhoneContactsField,
  readStringArrayField,
  readStringField,
} from "./admin-form-fields";
import { DEFAULT_SITE_SETTINGS } from "./defaults";
import type {
  SiteAssetType,
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
  "contact",
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
  hero: Pick<SiteSettingsDraft, "heroImageAlt">;
  seo: SeoDraft;
  contact: Pick<
    SiteSettingsDraft,
    | "bankAccountName"
    | "bankName"
    | "bankAccountNumber"
    | "phoneContacts"
    | "messengerUrl"
    | "lineId"
    | "lineUrl"
  >;
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
  hero: Pick<SiteSettings, "heroImage">;
  seo: Pick<SiteSettings, "seo" | "pageSeo">;
  contact: Pick<SiteSettings, "bank" | "contact">;
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
  hero: ["id,hero_image_path,hero_image_url,hero_image_alt"],
  seo: [
    "id,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords",
    "id,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls",
  ],
  contact: [
    "id,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url",
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
  hero: ["heroImageAlt"],
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
  contact: [
    "bankAccountName",
    "bankName",
    "bankAccountNumber",
    "phoneContacts",
    "messengerUrl",
    "lineId",
    "lineUrl",
  ],
} as const satisfies Record<SiteSettingsSection, readonly (keyof SiteSettingsDraft)[]>;

const SECTION_ASSET_TYPES = {
  brand: ["favicon", "logo"],
  theme: [],
  hero: ["hero"],
  seo: ["seo-og", "search-seo-og", "guides-seo-og"],
  contact: [],
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
    villaCardStyle: DEFAULT_SITE_SETTINGS.villaCardStyle,
    heroImageAlt: DEFAULT_SITE_SETTINGS.heroImage.alt,
    bankAccountName: DEFAULT_SITE_SETTINGS.bank.accountName,
    bankName: DEFAULT_SITE_SETTINGS.bank.bankName,
    bankAccountNumber: DEFAULT_SITE_SETTINGS.bank.accountNumber,
    phoneContacts: DEFAULT_SITE_SETTINGS.contact.phoneContacts.map((contact) => ({
      ...contact,
    })),
    messengerUrl: DEFAULT_SITE_SETTINGS.contact.messengerUrl,
    lineId: DEFAULT_SITE_SETTINGS.contact.lineId,
    lineUrl: DEFAULT_SITE_SETTINGS.contact.lineUrl,
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

  for (const assetType of SECTION_ASSET_TYPES[section]) {
    const upload = ASSET_UPLOAD_FIELDS.find((field) => field.assetType === assetType);
    if (upload) {
      allowedKeys.add(upload.fieldName);
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

  const draft = defaultDraft();

  if (body instanceof FormData) {
    if (section === "contact" && body.has("phoneContacts")) {
      const contacts = readPhoneContactsField(body);
      if (!contacts.ok) {
        return { ok: false, errors: [contacts.error] };
      }
      draft.phoneContacts = contacts.value;
    }

    for (const field of fields) {
      if (!body.has(field) || field === "phoneContacts") {
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
      if (field === "phoneContacts") {
        if (
          !Array.isArray(value) ||
          value.some(
            (item) =>
              !item ||
              typeof item !== "object" ||
              typeof (item as Record<string, unknown>).name !== "string" ||
              typeof (item as Record<string, unknown>).phone !== "string" ||
              typeof (item as Record<string, unknown>).time !== "string",
          )
        ) {
          return { ok: false, errors: ["Invalid phoneContacts value."] };
        }
      } else if (ARRAY_FIELDS.has(field)) {
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
    hero: { heroImage: settings.heroImage },
    seo: { seo: settings.seo, pageSeo: settings.pageSeo },
    contact: { bank: settings.bank, contact: settings.contact },
  };

  return responses[section];
}

export function getSectionUploadFiles(
  section: SiteSettingsSection,
  formData: FormData,
) {
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
      const heroUpload = uploaded("hero");
      return {
        hero_image_path: heroUpload?.path ?? currentSettings.heroImage.path,
        hero_image_url: heroUpload?.publicUrl ?? currentSettings.heroImage.url,
        hero_image_alt: hero.heroImageAlt,
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
    case "contact": {
      const contact = draft as SiteSettingsSectionDraftMap["contact"];
      return {
        bank_account_name: contact.bankAccountName,
        bank_name: contact.bankName,
        bank_account_number: contact.bankAccountNumber,
        phone_contacts: contact.phoneContacts,
        messenger_url: contact.messengerUrl,
        line_id: contact.lineId,
        line_url: contact.lineUrl,
      };
    }
  }
}
