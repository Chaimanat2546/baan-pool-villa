import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "../defaults";
import {
  DEFAULT_DETAIL_LAYOUT,
  DEFAULT_DETAIL_LAYOUT_V2,
} from "../../detail-layout/defaults";
import {
  normalizeSiteSettingsDraft,
  normalizeSiteSettingsRow,
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "../validation";
import type { SiteSettingsDraft } from "../types";

const legacyWordPressOgImageUrl =
  "https://baanpoolvillas.com/wp-content/uploads/2026/03/BPV-66_Cover-Web.jpg";

const validRow = {
  id: "global",
  site_name: " Baan Pool Villa ",
  primary_color: "#123456",
  accent_color: "#abcdef",
  header_link_color: "#ffffff",
  header_link_hover_color: "#eab308",
  footer_link_color: "#ffffff",
  footer_link_hover_color: "#eab308",
  bank_highlight_color: "#eab308",
  bank_account_highlight_color: "#fde047",
  bank_name_highlight_color: "#facc15",
  bank_number_highlight_color: "#fef08a",
  logo_background: "soft",
  logo_image_path: "logo/2026/05/logo.webp",
  logo_image_url:
    "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
  favicon_image_path: "favicon/2026/05/icon.png",
  favicon_image_url:
    "https://example.supabase.co/storage/v1/object/public/site-assets/favicon/2026/05/icon.png",
  hero_image_path: "hero/2026/05/hero.webp",
  hero_image_url:
    "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
  hero_image_alt: " พูลวิลล่าพัทยา ",
  bank_account_name: " คุณ อาภัสรา จินดาวา ",
  bank_name: " ธนาคารกสิกรไทย ",
  bank_account_number: " 398-289-7482 ",
  phone_contacts: [
    {
      name: " คุณเกม ",
      phone: " 0617485213 ",
      time: " ช่วง 07.00-15.00 ",
    },
  ],
  messenger_url: " https://www.facebook.com/baanpoolvillas ",
  line_id: " @baanpoolvilla ",
  line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
  seo_title: " Baan Pool Villa Pattaya | Private Pool Villas ",
  seo_description:
    " Book private pool villas in Pattaya for families, friends, and party trips. ",
  seo_keywords: [
    " พูลวิลล่าพัทยา ",
    " บ้านพักพูลวิลล่า ",
    " พูลวิลล่าพัทยา ",
  ],
  seo_og_image_url: " /images/seo-cover.jpg ",
  seo_og_image_alt: " Pool villa with private swimming pool ",
  seo_business_name: " Baan Pool Villa Pattaya ",
  seo_same_as_urls: [
    " https://www.facebook.com/baanpoolvillas ",
    " https://line.me/R/ti/p/@baanpoolvilla ",
  ],
  search_seo_title: " ค้นหาบ้านพักพูลวิลล่าพัทยา ",
  search_seo_description: " ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเลและราคา ",
  search_seo_keywords: [" ค้นหาพูลวิลล่าพัทยา "],
  search_seo_og_image_url: " /images/search-cover.jpg ",
  search_seo_og_image_alt: " Search cover ",
  guides_seo_title: " บทความแนะนำบ้านพักพูลวิลล่าพัทยา ",
  guides_seo_description: " บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก ",
  guides_seo_keywords: [" บทความพูลวิลล่าพัทยา "],
  guides_seo_og_image_url: " /images/guides-cover.jpg ",
  guides_seo_og_image_alt: " Guides cover ",
  villa_detail_seo_keywords: [" รายละเอียดพูลวิลล่าพัทยา "],
  tiktok_account_url: " https://www.tiktok.com/@baanpoolvilla ",
  tiktok_video_urls: [
    "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
    "https://www.tiktok.com/player/v1/7370000000000000002",
  ],
  detail_layout: DEFAULT_DETAIL_LAYOUT,
};

const validSectionSeoDraftFields = {
  searchSeoTitle: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
  searchSeoDescription: "ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเลและราคา",
  searchSeoOgImageUrl: "/images/search-cover.jpg",
  searchSeoOgImageAlt: "Search cover",
  guidesSeoTitle: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา",
  guidesSeoDescription: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก",
  guidesSeoOgImageUrl: "/images/guides-cover.jpg",
  guidesSeoOgImageAlt: "Guides cover",
};

const validDraft: SiteSettingsDraft = {
  siteName: "Baan Pool Villa",
  primaryColor: "#064e3b",
  accentColor: "#eab308",
  headerLinkColor: "#ffffff",
  headerLinkHoverColor: "#eab308",
  footerLinkColor: "#ffffff",
  footerLinkHoverColor: "#eab308",
  bankHighlightColor: "#eab308",
  bankAccountHighlightColor: "#fde047",
  bankNameHighlightColor: "#facc15",
  bankNumberHighlightColor: "#fef08a",
  logoBackground: "white",
  heroImageAlt: "Hero image for validation",
  bankAccountName: "Account Name",
  bankName: "Bank Name",
  bankAccountNumber: "398-289-7482",
  phoneContacts: [
    {
      name: "Owner",
      phone: "0617485213",
      time: "07.00-15.00",
    },
  ],
  messengerUrl: "https://www.facebook.com/baanpoolvillas",
  lineId: "@baanpoolvilla",
  lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
  seoTitle: "Baan Pool Villa Pattaya | Private Pool Villas",
  seoDescription:
    "Book private pool villas in Pattaya for families, friends, and party trips.",
  seoKeywords: ["พูลวิลล่าพัทยา", "บ้านพักพูลวิลล่า"],
  seoOgImageUrl: "/images/seo-cover.jpg",
  seoOgImageAlt: "Pool villa with private swimming pool",
  seoBusinessName: "Baan Pool Villa Pattaya",
  seoSameAsUrls: ["https://www.facebook.com/baanpoolvillas"],
  ...validSectionSeoDraftFields,
  searchSeoKeywords: ["ค้นหาพูลวิลล่าพัทยา"],
  guidesSeoKeywords: ["บทความพูลวิลล่าพัทยา"],
  villaDetailSeoKeywords: ["รายละเอียดพูลวิลล่าพัทยา"],
  tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
  tiktokVideoUrls: [
    "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
  ],
};

describe("normalizeSiteSettingsRow", () => {
  it("returns defaults when the row is null", () => {
    expect(normalizeSiteSettingsRow(null)).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it("normalizes a valid database row including section SEO", () => {
    expect(normalizeSiteSettingsRow(validRow)).toEqual({
      siteName: "Baan Pool Villa",
      primaryColor: "#123456",
      accentColor: "#abcdef",
      headerLinkColor: "#ffffff",
      headerLinkHoverColor: "#eab308",
      footerLinkColor: "#ffffff",
      footerLinkHoverColor: "#eab308",
      bankHighlightColor: "#eab308",
      bankAccountHighlightColor: "#fde047",
      bankNameHighlightColor: "#facc15",
      bankNumberHighlightColor: "#fef08a",
      logoBackground: "soft",
      logoImage: {
        path: "logo/2026/05/logo.webp",
        url: "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
        alt: "Baan Pool Villa logo",
      },
      faviconImage: {
        path: "favicon/2026/05/icon.png",
        url: "https://example.supabase.co/storage/v1/object/public/site-assets/favicon/2026/05/icon.png",
        alt: "Baan Pool Villa icon",
      },
      heroImage: {
        path: "hero/2026/05/hero.webp",
        url: "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
        alt: "พูลวิลล่าพัทยา",
      },
      bank: {
        accountName: "คุณ อาภัสรา จินดาวา",
        bankName: "ธนาคารกสิกรไทย",
        accountNumber: "398-289-7482",
      },
      contact: {
        phoneContacts: [
          {
            name: "คุณเกม",
            phone: "0617485213",
            time: "ช่วง 07.00-15.00",
          },
        ],
        messengerUrl: "https://www.facebook.com/baanpoolvillas",
        lineId: "@baanpoolvilla",
        lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      },
      seo: {
        title: "Baan Pool Villa Pattaya | Private Pool Villas",
        description:
          "Book private pool villas in Pattaya for families, friends, and party trips.",
        keywords: ["พูลวิลล่าพัทยา", "บ้านพักพูลวิลล่า"],
        ogImage: {
          path: "/images/seo-cover.jpg",
          url: "/images/seo-cover.jpg",
          alt: "Pool villa with private swimming pool",
        },
        businessName: "Baan Pool Villa Pattaya",
        sameAsUrls: [
          "https://www.facebook.com/baanpoolvillas",
          "https://line.me/R/ti/p/@baanpoolvilla",
        ],
      },
      pageSeo: {
        search: {
          title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
          description: "ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเลและราคา",
          keywords: ["ค้นหาพูลวิลล่าพัทยา"],
          ogImage: {
            path: "/images/search-cover.jpg",
            url: "/images/search-cover.jpg",
            alt: "Search cover",
          },
        },
        guides: {
          title: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา",
          description: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก",
          keywords: ["บทความพูลวิลล่าพัทยา"],
          ogImage: {
            path: "/images/guides-cover.jpg",
            url: "/images/guides-cover.jpg",
            alt: "Guides cover",
          },
        },
        villaDetail: {
          keywords: ["รายละเอียดพูลวิลล่าพัทยา"],
        },
      },
      tiktok: {
        accountUrl: "https://www.tiktok.com/@baanpoolvilla",
        videos: [
          {
            url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
            videoId: "7370000000000000001",
          },
          {
            url: "https://www.tiktok.com/player/v1/7370000000000000002",
            videoId: "7370000000000000002",
          },
        ],
      },
      detailLayout: DEFAULT_DETAIL_LAYOUT,
    });
  });

  it("keeps a valid V2 detail layout from the database row", () => {
    const settings = normalizeSiteSettingsRow({
      ...validRow,
      detail_layout: DEFAULT_DETAIL_LAYOUT_V2,
    });

    expect(settings.detailLayout).toEqual(DEFAULT_DETAIL_LAYOUT_V2);
    expect(settings.detailLayout).not.toBe(DEFAULT_DETAIL_LAYOUT_V2);
  });

  it("normalizes link and bank highlight colors from the database row", () => {
    expect(
      normalizeSiteSettingsRow({
        ...validRow,
        header_link_color: " #ABCDEF ",
        header_link_hover_color: "#123456",
        footer_link_color: "#654321",
        footer_link_hover_color: "#fedcba",
        bank_highlight_color: "#0f172a",
        bank_account_highlight_color: "#1d4ed8",
        bank_name_highlight_color: "#7c3aed",
        bank_number_highlight_color: "#be123c",
      }),
    ).toMatchObject({
      headerLinkColor: "#abcdef",
      headerLinkHoverColor: "#123456",
      footerLinkColor: "#654321",
      footerLinkHoverColor: "#fedcba",
      bankHighlightColor: "#0f172a",
      bankAccountHighlightColor: "#1d4ed8",
      bankNameHighlightColor: "#7c3aed",
      bankNumberHighlightColor: "#be123c",
    });
  });

  it("falls back separate bank highlight colors to the shared bank highlight", () => {
    expect(
      normalizeSiteSettingsRow({
        ...validRow,
        bank_highlight_color: "#0f172a",
        bank_account_highlight_color: "not-a-color",
        bank_name_highlight_color: null,
        bank_number_highlight_color: undefined,
      }),
    ).toMatchObject({
      bankHighlightColor: "#0f172a",
      bankAccountHighlightColor: "#0f172a",
      bankNameHighlightColor: "#0f172a",
      bankNumberHighlightColor: "#0f172a",
    });
  });

  it("rewrites the legacy WordPress OG image to the local default image", () => {
    const settings = normalizeSiteSettingsRow({
      ...validRow,
      seo_og_image_url: legacyWordPressOgImageUrl,
      search_seo_og_image_url: legacyWordPressOgImageUrl,
      guides_seo_og_image_url: legacyWordPressOgImageUrl,
    });

    expect(settings.seo.ogImage).toMatchObject({
      path: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
      url: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
    });
    expect(settings.pageSeo.search.ogImage).toMatchObject({
      path: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.url,
      url: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.url,
    });
    expect(settings.pageSeo.guides.ogImage).toMatchObject({
      path: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.url,
      url: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.url,
    });
  });

  it("falls back for malformed colors and missing images", () => {
    expect(
      normalizeSiteSettingsRow({
        id: "global",
        site_name: "",
        primary_color: "green",
        accent_color: "#12345",
        logo_image_path: null,
        logo_image_url: null,
        favicon_image_path: null,
        favicon_image_url: null,
        hero_image_path: null,
        hero_image_url: null,
        hero_image_alt: "",
        bank_account_name: "",
        bank_name: "",
        bank_account_number: "",
        phone_contacts: [],
        messenger_url: "javascript:alert(1)",
        line_id: "",
        line_url: "ftp://example.com/line",
        seo_title: "",
        seo_description: "",
        seo_keywords: "not-jsonb-array",
        seo_og_image_url: "javascript:alert(1)",
        seo_og_image_alt: "",
        seo_business_name: "",
        seo_same_as_urls: ["javascript:alert(1)"],
        search_seo_title: "",
        search_seo_description: "",
        search_seo_keywords: "not-jsonb-array",
        search_seo_og_image_url: "javascript:alert(1)",
        search_seo_og_image_alt: "",
        guides_seo_title: "",
        guides_seo_description: "",
        guides_seo_keywords: "not-jsonb-array",
        guides_seo_og_image_url: "javascript:alert(1)",
        guides_seo_og_image_alt: "",
        villa_detail_seo_keywords: "not-jsonb-array",
        detail_layout: {
          version: 1,
          lockedTop: ["intro", "gallery"],
          rows: [],
        },
      }),
    ).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it("falls back when logo or hero image URLs are unsafe", () => {
    const settings = normalizeSiteSettingsRow({
      ...validRow,
      logo_image_url: "javascript:alert(1)",
      favicon_image_url: "https://127.0.0.1/favicon.png",
      hero_image_url: "https://127.0.0.1/hero.webp",
    });

    expect(settings.logoImage).toEqual(DEFAULT_SITE_SETTINGS.logoImage);
    expect(settings.faviconImage).toEqual(DEFAULT_SITE_SETTINGS.faviconImage);
    expect(settings.heroImage).toEqual(DEFAULT_SITE_SETTINGS.heroImage);
  });
});

describe("normalizeSiteSettingsDraft", () => {
  it("trims text fields and lowercases colors including section SEO", () => {
    expect(
      normalizeSiteSettingsDraft({
        ...validDraft,
        siteName: " Baan Pool Villa ",
        primaryColor: " #064E3B ",
        accentColor: " #EAB308 ",
        headerLinkColor: " #FFFFFF ",
        headerLinkHoverColor: " #EAB308 ",
        footerLinkColor: " #FFFFFF ",
        footerLinkHoverColor: " #EAB308 ",
        bankHighlightColor: " #EAB308 ",
        bankAccountHighlightColor: " #FDE047 ",
        bankNameHighlightColor: " #FACC15 ",
        bankNumberHighlightColor: " #FEF08A ",
        logoBackground: " primary ",
        heroImageAlt: " Pool villas in Pattaya ",
        bankAccountName: " Account Name ",
        bankName: " Bank Name ",
        bankAccountNumber: " 398-289-7482 ",
        phoneContacts: [
          {
            name: " Game ",
            phone: " 061-748-5213 ",
            time: " 07.00-15.00 ",
          },
        ],
        messengerUrl: " https://www.facebook.com/baanpoolvillas ",
        lineId: " @baanpoolvilla ",
        lineUrl: " https://line.me/R/ti/p/@baanpoolvilla ",
        seoTitle: " Baan Pool Villa Pattaya | Private Pool Villas ",
        seoDescription: " Book private pool villas in Pattaya. ",
        seoKeywords: [" พูลวิลล่าพัทยา ", "", " บ้านพักพูลวิลล่า ", "พูลวิลล่าพัทยา"],
        seoOgImageUrl: " /images/seo-cover.jpg ",
        seoOgImageAlt: " Pool villa with private swimming pool ",
        seoBusinessName: " Baan Pool Villa Pattaya ",
        seoSameAsUrls: [
          " https://www.facebook.com/baanpoolvillas ",
          " https://line.me/R/ti/p/@baanpoolvilla ",
        ],
        searchSeoTitle: " ค้นหาบ้านพักพูลวิลล่าพัทยา ",
        searchSeoDescription: " ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเลและราคา ",
        searchSeoKeywords: [" ค้นหาพูลวิลล่าพัทยา ", ""],
        searchSeoOgImageUrl: " /images/search-cover.jpg ",
        searchSeoOgImageAlt: " Search cover ",
        guidesSeoTitle: " บทความแนะนำบ้านพักพูลวิลล่าพัทยา ",
        guidesSeoDescription: " บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก ",
        guidesSeoKeywords: [" บทความพูลวิลล่าพัทยา ", ""],
        guidesSeoOgImageUrl: " /images/guides-cover.jpg ",
        guidesSeoOgImageAlt: " Guides cover ",
        villaDetailSeoKeywords: [" รายละเอียดพูลวิลล่าพัทยา ", ""],
        tiktokAccountUrl: " https://www.tiktok.com/@baanpoolvilla ",
        tiktokVideoUrls: [
          " https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH ",
          "",
          " https://www.tiktok.com/player/v1/7370000000000000002 ",
        ],
      }),
    ).toEqual({
      ...validDraft,
      siteName: "Baan Pool Villa",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      headerLinkColor: "#ffffff",
      headerLinkHoverColor: "#eab308",
        footerLinkColor: "#ffffff",
        footerLinkHoverColor: "#eab308",
        bankHighlightColor: "#eab308",
        bankAccountHighlightColor: "#fde047",
        bankNameHighlightColor: "#facc15",
        bankNumberHighlightColor: "#fef08a",
        logoBackground: "primary",
      heroImageAlt: "Pool villas in Pattaya",
      bankAccountName: "Account Name",
      bankName: "Bank Name",
      bankAccountNumber: "398-289-7482",
      phoneContacts: [
        {
          name: "Game",
          phone: "061-748-5213",
          time: "07.00-15.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      seoTitle: "Baan Pool Villa Pattaya | Private Pool Villas",
      seoDescription: "Book private pool villas in Pattaya.",
      seoKeywords: ["พูลวิลล่าพัทยา", "บ้านพักพูลวิลล่า"],
      seoOgImageUrl: "/images/seo-cover.jpg",
      seoOgImageAlt: "Pool villa with private swimming pool",
      seoBusinessName: "Baan Pool Villa Pattaya",
      seoSameAsUrls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
      ...validSectionSeoDraftFields,
      searchSeoKeywords: ["ค้นหาพูลวิลล่าพัทยา"],
      guidesSeoKeywords: ["บทความพูลวิลล่าพัทยา"],
      villaDetailSeoKeywords: ["รายละเอียดพูลวิลล่าพัทยา"],
      tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
      tiktokVideoUrls: [
        "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
        "https://www.tiktok.com/player/v1/7370000000000000002",
      ],
    });
  });

  it("rewrites legacy WordPress OG image draft values to the local default image", () => {
    expect(
      normalizeSiteSettingsDraft({
        ...validDraft,
        seoOgImageUrl: ` ${legacyWordPressOgImageUrl} `,
        searchSeoOgImageUrl: ` ${legacyWordPressOgImageUrl} `,
        guidesSeoOgImageUrl: ` ${legacyWordPressOgImageUrl} `,
      }),
    ).toMatchObject({
      seoOgImageUrl: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
      searchSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.url,
      guidesSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.url,
    });
  });

  it("trims and lowercases link and bank highlight color drafts", () => {
    expect(
      normalizeSiteSettingsDraft({
        ...validDraft,
        headerLinkColor: " #ABCDEF ",
        headerLinkHoverColor: " #123456 ",
        footerLinkColor: " #654321 ",
        footerLinkHoverColor: " #FEDCBA ",
        bankHighlightColor: " #0F172A ",
        bankAccountHighlightColor: " #1D4ED8 ",
        bankNameHighlightColor: " #7C3AED ",
        bankNumberHighlightColor: " #BE123C ",
      }),
    ).toMatchObject({
      headerLinkColor: "#abcdef",
      headerLinkHoverColor: "#123456",
      footerLinkColor: "#654321",
      footerLinkHoverColor: "#fedcba",
      bankHighlightColor: "#0f172a",
      bankAccountHighlightColor: "#1d4ed8",
      bankNameHighlightColor: "#7c3aed",
      bankNumberHighlightColor: "#be123c",
    });
  });
});

describe("validateSiteSettingsDraft", () => {
  it("accepts a complete valid draft", () => {
    expect(validateSiteSettingsDraft(validDraft)).toEqual([]);
  });

  it("accepts Thai phone numbers with optional display separators", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        phoneContacts: [
          {
            name: "คุณเกม",
            phone: "061-748-5213",
            time: "ช่วง 07.00-15.00",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects phone numbers that do not match the Thai mobile format", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        phoneContacts: [
          {
            name: "คุณเกม",
            phone: "12345",
            time: "ช่วง 07.00-15.00",
          },
          {
            name: "คุณบี",
            phone: "+66617485213",
            time: "ช่วง 07.00-15.00",
          },
        ],
      }),
    ).toEqual([
      "เบอร์โทรผู้ติดต่อคนที่ 1 ต้องเป็นเบอร์ไทย 10 หลัก เช่น 0xxxxxxxxx",
      "เบอร์โทรผู้ติดต่อคนที่ 2 ต้องเป็นเบอร์ไทย 10 หลัก เช่น 0xxxxxxxxx",
    ]);
  });

  it("rejects invalid global and section SEO settings", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        seoTitle: "",
        seoDescription: "",
        seoOgImageUrl: "javascript:alert(1)",
        seoOgImageAlt: "",
        seoBusinessName: "",
        seoSameAsUrls: ["javascript:alert(1)", "ftp://example.com/profile"],
        searchSeoTitle: "",
        searchSeoDescription: "",
        searchSeoOgImageUrl: "javascript:alert(1)",
        searchSeoOgImageAlt: "",
        guidesSeoTitle: "",
        guidesSeoDescription: "",
        guidesSeoOgImageUrl: "javascript:alert(1)",
        guidesSeoOgImageAlt: "",
      }),
    ).toEqual([
      "ต้องใส่ชื่อหน้าที่แสดงบน Google",
      "ต้องใส่คำอธิบายเว็บที่แสดงบน Google",
      "รูปตัวอย่างตอนแชร์ลิงก์ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /",
      "ต้องใส่คำอธิบายรูปตอนแชร์ลิงก์",
      "ต้องใส่ชื่อธุรกิจสำหรับ SEO",
      "ลิงก์โซเชียลของร้านรายการที่ 1 ต้องเป็น URL แบบ http หรือ https",
      "ลิงก์โซเชียลของร้านรายการที่ 2 ต้องเป็น URL แบบ http หรือ https",
      "ต้องใส่ชื่อหน้า SEO ของหน้าค้นหา (/search)",
      "ต้องใส่คำอธิบาย SEO ของหน้าค้นหา (/search)",
      "รูปแชร์ลิงก์ของหน้าค้นหา (/search)ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /",
      "ต้องใส่คำอธิบายรูปแชร์ลิงก์ของหน้าค้นหา (/search)",
      "ต้องใส่ชื่อหน้า SEO ของหน้าบทความ (/guides)",
      "ต้องใส่คำอธิบาย SEO ของหน้าบทความ (/guides)",
      "รูปแชร์ลิงก์ของหน้าบทความ (/guides)ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /",
      "ต้องใส่คำอธิบายรูปแชร์ลิงก์ของหน้าบทความ (/guides)",
    ]);
  });

  it("rejects unsafe and oversized SEO keyword lists", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        seoKeywords: [],
        searchSeoKeywords: ["x", "พูลวิลล่า<script>"],
        guidesSeoKeywords: Array.from({ length: 31 }, (_, index) => `บทความ ${index + 1}`),
        villaDetailSeoKeywords: ["ก".repeat(61)],
      }),
    ).toEqual([
      "ต้องใส่คำค้น SEO ของหน้าแรก / ค่าเริ่มต้นอย่างน้อย 1 รายการ",
      "คำค้น SEO ของหน้าค้นหา (/search)รายการที่ 1 ต้องมีอย่างน้อย 2 ตัวอักษร",
      "คำค้น SEO ของหน้าค้นหา (/search)รายการที่ 2 ห้ามมีเครื่องหมาย <, > หรืออักขระควบคุม",
      "คำค้น SEO ของหน้าบทความ (/guides)ต้องไม่เกิน 30 รายการ",
      "คำค้น SEO ของหน้ารายละเอียดบ้านรายการที่ 1 ต้องไม่เกิน 60 ตัวอักษร",
    ]);
  });

  it("validates general required fields and link formats", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        siteName: " ",
        primaryColor: "064e3b",
        accentColor: "#gggggg",
        headerLinkColor: "red",
        headerLinkHoverColor: "#12345",
        footerLinkColor: "javascript:alert(1)",
        footerLinkHoverColor: "#xyzxyz",
        bankHighlightColor: "",
        bankAccountHighlightColor: "gold",
        bankNameHighlightColor: "#12345",
        bankNumberHighlightColor: "123456",
        logoBackground: "checkerboard",
        heroImageAlt: "x".repeat(161),
        bankAccountName: "",
        bankName: "",
        bankAccountNumber: "",
        phoneContacts: [
          {
            name: "",
            phone: "",
            time: "",
          },
        ],
        messengerUrl: "not a url",
        lineId: "",
        lineUrl: "javascript:alert(1)",
      }),
    ).toEqual([
      "ต้องใส่ชื่อเว็บ",
      "สีหลักต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเน้นต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเมนูใน Header ต้องเป็นค่าสีแบบ #RRGGBB",
      "สี Hover เมนูใน Header ต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเมนูใน Footer ต้องเป็นค่าสีแบบ #RRGGBB",
      "สี Hover เมนูใน Footer ต้องเป็นค่าสีแบบ #RRGGBB",
      "สีไฮไลท์บัญชีต้องเป็นค่าสีแบบ #RRGGBB",
      "สีชื่อบัญชีต้องเป็นค่าสีแบบ #RRGGBB",
      "สีชื่อธนาคารต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเลขบัญชีต้องเป็นค่าสีแบบ #RRGGBB",
      "พื้นหลังโลโก้ต้องเป็น ขาว, โปร่งใส, สีหลัก หรือสีอ่อน",
      "คำอธิบายรูป Hero ต้องไม่เกิน 160 ตัวอักษร",
      "ต้องใส่ชื่อบัญชีธนาคาร",
      "ต้องใส่ชื่อธนาคาร",
      "ต้องใส่เลขบัญชีธนาคาร",
      "ต้องใส่ชื่อผู้ติดต่อคนที่ 1",
      "ต้องใส่เบอร์โทรผู้ติดต่อคนที่ 1",
      "ต้องใส่ช่วงเวลาผู้ติดต่อคนที่ 1",
      "ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https",
      "ต้องใส่ LINE ID",
      "ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https",
    ]);
  });

  it("validates TikTok account and video rules", () => {
    expect(
      validateSiteSettingsDraft({
        ...validDraft,
        tiktokAccountUrl: "",
        tiktokVideoUrls: ["https://vm.tiktok.com/ZMabc123/"],
      }),
    ).toEqual([
      "ต้องใส่ลิงก์บัญชี TikTok เมื่อใส่วิดีโอ TikTok",
      "ลิงก์วิดีโอ TikTok รายการที่ 1 ต้องเป็นลิงก์วิดีโอแบบเต็ม เช่น https://www.tiktok.com/@account/video/1234567890",
    ]);
  });
});

describe("validateUploadMetadata", () => {
  it("accepts configured image mime types under the size limit", () => {
    expect(
      validateUploadMetadata(
        "hero",
        "image/webp",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
        "hero.webp",
      ),
    ).toEqual([]);
  });

  it("rejects unsupported file types and oversized files", () => {
    expect(
      validateUploadMetadata(
        "logo",
        "image/gif",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES + 1,
        "logo.gif",
      ),
    ).toEqual([
      "ไฟล์โลโก้ต้องเป็น JPG, PNG หรือ WebP",
      "นามสกุลไฟล์โลโก้ต้องเป็น .jpg, .jpeg, .png หรือ .webp",
      "ไฟล์โลโก้ต้องมีขนาดไม่เกิน 6MB",
    ]);
  });

  it("rejects files with unsupported image extensions even when MIME type is allowed", () => {
    expect(
      validateUploadMetadata(
        "hero",
        "image/png",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
        "hero.txt",
      ),
    ).toEqual(["นามสกุลไฟล์Heroต้องเป็น .jpg, .jpeg, .png หรือ .webp"]);
  });

  it("uses a Thai favicon label for favicon upload validation errors", () => {
    expect(
      validateUploadMetadata(
        "favicon",
        "image/svg+xml",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES + 1,
        "icon.svg",
      ),
    ).toEqual([
      "ไฟล์ไอคอนเว็บไซต์ต้องเป็น JPG, PNG หรือ WebP",
      "นามสกุลไฟล์ไอคอนเว็บไซต์ต้องเป็น .jpg, .jpeg, .png หรือ .webp",
      "ไฟล์ไอคอนเว็บไซต์ต้องมีขนาดไม่เกิน 6MB",
    ]);
  });
});
