import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "../defaults";
import { normalizeSiteSettingsRow } from "../validation";
import {
  SITE_SETTINGS_SECTIONS,
  buildSiteSettingsSectionPayload,
  getSectionUploadFiles,
  getSiteSettingsSectionSelects,
  isSiteSettingsSection,
  mapSiteSettingsSectionResponse,
  parseSiteSettingsSectionRequest,
  type SiteSettingsSectionDraftMap,
} from "../admin-section-contracts";

describe("admin site-settings section contracts", () => {
  it("defines the exact supported section set and runtime guard", () => {
    expect(SITE_SETTINGS_SECTIONS).toEqual([
      "brand",
      "theme",
      "hero",
      "seo",
    ]);
    expect(isSiteSettingsSection("brand")).toBe(true);
    expect(isSiteSettingsSection("security")).toBe(false);
  });

  it("returns ordered, section-owned database projection fallbacks", () => {
    expect(getSiteSettingsSectionSelects("brand")).toEqual([
      "id,site_name,logo_background,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url",
      "id,site_name,logo_background,logo_image_path,logo_image_url",
    ]);
    expect(getSiteSettingsSectionSelects("theme")).toEqual([
      "id,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color",
      "id,primary_color,accent_color",
    ]);
    expect(getSiteSettingsSectionSelects("hero")).toEqual([
      "id,hero_image_path,hero_image_url,hero_image_alt",
    ]);
    expect(getSiteSettingsSectionSelects("seo")).toEqual([
      "id,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords",
      "id,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls",
    ]);
  });

  it("maps only the requested normalized response section", () => {
    const settings = normalizeSiteSettingsRow({
      id: "global",
      site_name: "Section Brand",
      primary_color: "#112233",
      accent_color: "#445566",
      logo_image_path: "logo/current.webp",
      logo_image_url: "https://example.com/logo.webp",
      hero_image_path: null,
      hero_image_url: null,
      hero_image_alt: null,
    });

    expect(mapSiteSettingsSectionResponse("brand", settings)).toEqual({
      siteName: "Section Brand",
      logoBackground: DEFAULT_SITE_SETTINGS.logoBackground,
      logoImage: {
        path: "logo/current.webp",
        url: "https://example.com/logo.webp",
        alt: "Section Brand logo",
      },
      faviconImage: DEFAULT_SITE_SETTINGS.faviconImage,
    });
    expect(mapSiteSettingsSectionResponse("theme", settings)).toEqual({
      primaryColor: "#112233",
      accentColor: "#445566",
      headerLinkColor: DEFAULT_SITE_SETTINGS.headerLinkColor,
      headerLinkHoverColor: DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
      footerLinkColor: DEFAULT_SITE_SETTINGS.footerLinkColor,
      footerLinkHoverColor: DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
      bankHighlightColor: DEFAULT_SITE_SETTINGS.bankHighlightColor,
      bankAccountHighlightColor: DEFAULT_SITE_SETTINGS.bankAccountHighlightColor,
      bankNameHighlightColor: DEFAULT_SITE_SETTINGS.bankNameHighlightColor,
      bankNumberHighlightColor: DEFAULT_SITE_SETTINGS.bankNumberHighlightColor,
    });
  });

  it("rejects cross-section JSON keys before normalization", () => {
    expect(
      parseSiteSettingsSectionRequest("theme", {
        primaryColor: "#112233",
        siteName: "must be rejected",
      }),
    ).toEqual({ ok: false, errors: [expect.stringContaining("siteName")] });
  });

  it("normalizes and validates only the requested JSON section", () => {
    expect(
      parseSiteSettingsSectionRequest("theme", {
        primaryColor: " #AABBCC ",
        accentColor: "#112233",
        headerLinkColor: "#223344",
        headerLinkHoverColor: "#334455",
        footerLinkColor: "#445566",
        footerLinkHoverColor: "#556677",
        bankHighlightColor: "#667788",
        bankAccountHighlightColor: "#778899",
        bankNameHighlightColor: "#8899AA",
        bankNumberHighlightColor: "#99AABB",
      }),
    ).toEqual({
      ok: true,
      draft: {
        primaryColor: "#aabbcc",
        accentColor: "#112233",
        headerLinkColor: "#223344",
        headerLinkHoverColor: "#334455",
        footerLinkColor: "#445566",
        footerLinkHoverColor: "#556677",
        bankHighlightColor: "#667788",
        bankAccountHighlightColor: "#778899",
        bankNameHighlightColor: "#8899aa",
        bankNumberHighlightColor: "#99aabb",
      },
    });

    const invalid = parseSiteSettingsSectionRequest("theme", {
      primaryColor: "not-a-color",
    });
    expect(invalid.ok).toBe(false);
  });

  it("parses multipart section values while excluding owned file keys", () => {
    const formData = new FormData();
    formData.set("siteName", " Brand Name ");
    formData.set("logoBackground", "white");
    formData.set("logo", new File(["logo"], "logo.webp", { type: "image/webp" }));

    expect(parseSiteSettingsSectionRequest("brand", formData)).toEqual({
      ok: true,
      draft: { siteName: "Brand Name", logoBackground: "white" },
    });
  });

  it("narrows uploads to section ownership and rejects cross-section files", () => {
    const brandData = new FormData();
    const logo = new File(["logo"], "logo.webp", { type: "image/webp" });
    brandData.set("logo", logo);

    expect(getSectionUploadFiles("brand", brandData)).toEqual({
      errors: [],
      uploadFiles: [{ assetType: "logo", file: logo }],
    });

    const wrongSectionData = new FormData();
    wrongSectionData.set(
      "hero",
      new File(["hero"], "hero.webp", { type: "image/webp" }),
    );

    const wrongSection = getSectionUploadFiles("brand", wrongSectionData);
    expect(wrongSection.uploadFiles).toEqual([]);
    expect(wrongSection.errors).toEqual([expect.stringContaining("hero")]);
  });

  it("builds brand payloads with uploaded or retained section assets only", () => {
    const draft: SiteSettingsSectionDraftMap["brand"] = {
      siteName: "New Brand",
      logoBackground: "primary",
    };

    expect(
      buildSiteSettingsSectionPayload("brand", draft, DEFAULT_SITE_SETTINGS, [
        {
          assetType: "logo",
          path: "logo/new.webp",
          publicUrl: "https://example.com/new-logo.webp",
        },
      ]),
    ).toEqual({
      site_name: "New Brand",
      logo_background: "primary",
      logo_image_path: "logo/new.webp",
      logo_image_url: "https://example.com/new-logo.webp",
      favicon_image_path: DEFAULT_SITE_SETTINGS.faviconImage.path,
      favicon_image_url: DEFAULT_SITE_SETTINGS.faviconImage.url,
    });
  });
});
