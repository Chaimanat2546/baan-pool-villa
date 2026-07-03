import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "./defaults";
import {
  isSiteLogoBackground,
  normalizeSiteLogoBackground,
} from "./logo-background";
import { isAllowedPublicImageHostname } from "@/lib/public-image-proxy";
import { normalizeAnyDetailLayout } from "../detail-layout/compat";
import type {
  SiteAssetUploadRecord,
  SiteAssetType,
  SiteImageSettings,
  SitePhoneContact,
  SiteSettings,
  SiteTikTokVideoSettings,
  SiteSettingsDraft,
  SiteSettingsRow,
} from "./types";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const HERO_IMAGE_ALT_MAX_LENGTH = 160;
const SEO_TITLE_MAX_LENGTH = 80;
const SEO_DESCRIPTION_MAX_LENGTH = 180;
const SEO_IMAGE_ALT_MAX_LENGTH = 160;
const SEO_BUSINESS_NAME_MAX_LENGTH = 100;
const SEO_SAME_AS_URLS_MAX_COUNT = 6;
const SEO_KEYWORDS_MAX_COUNT = 30;
const SEO_KEYWORD_MIN_LENGTH = 2;
const SEO_KEYWORD_MAX_LENGTH = 60;
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const TIKTOK_VIDEO_ID_PATTERN = /^\d{8,30}$/;
const TIKTOK_PROFILE_PATH_PATTERN = /^\/@[^/]+\/?$/;
const TIKTOK_PROFILE_VIDEO_PATH_PATTERN = /^\/@[^/]+\/video\/(\d{8,30})\/?$/;
const TIKTOK_PLAYER_VIDEO_PATH_PATTERN = /^\/player\/v1\/(\d{8,30})\/?$/;
const THAI_PHONE_PATTERN = /^0\d{9}$/;
const RETAINED_UPLOADS_PER_ASSET_TYPE = 3;
const SITE_ASSET_TYPES: SiteAssetType[] = [
  "hero",
  "logo",
  "seo-og",
  "search-seo-og",
  "guides-seo-og",
];
const SITE_SETTINGS_ALLOWED_IMAGE_EXTENSIONS = new Set([
  "jpeg",
  "jpg",
  "png",
  "webp",
]);
const LEGACY_WORDPRESS_OG_IMAGE_URL =
  "https://baanpoolvillas.com/wp-content/uploads/2026/03/BPV-66_Cover-Web.jpg";

/**
 * Checks whether a string is a hex color in the `#RRGGBB` format.
 *
 * @param value - The string to test for hex color format.
 * @returns `true` if `value` matches `#RRGGBB`, `false` otherwise.
 */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

/**
 * Normalizes a raw site-settings row into the shared settings shape used by
 * public pages and admin surfaces.
 *
 * @param row - The raw site-settings row from Supabase, or `null` when no row
 * is stored.
 * @returns The normalized site settings with safe defaults applied where
 * values are missing or invalid.
 */
export function normalizeSiteSettingsRow(
  row: SiteSettingsRow | null,
): SiteSettings {
  if (row === null) {
    return DEFAULT_SITE_SETTINGS;
  }

  const siteName = normalizeRequiredText(
    row.site_name,
    DEFAULT_SITE_SETTINGS.siteName,
  );
  const primaryColor = normalizeColor(
    row.primary_color,
    DEFAULT_SITE_SETTINGS.primaryColor,
  );
  const accentColor = normalizeColor(
    row.accent_color,
    DEFAULT_SITE_SETTINGS.accentColor,
  );
  const headerLinkColor = normalizeColor(
    row.header_link_color,
    DEFAULT_SITE_SETTINGS.headerLinkColor,
  );
  const headerLinkHoverColor = normalizeColor(
    row.header_link_hover_color,
    DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
  );
  const footerLinkColor = normalizeColor(
    row.footer_link_color,
    DEFAULT_SITE_SETTINGS.footerLinkColor,
  );
  const footerLinkHoverColor = normalizeColor(
    row.footer_link_hover_color,
    DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
  );
  const bankHighlightColor = normalizeColor(
    row.bank_highlight_color,
    DEFAULT_SITE_SETTINGS.bankHighlightColor,
  );
  const logoBackground = normalizeSiteLogoBackground(
    row.logo_background,
    DEFAULT_SITE_SETTINGS.logoBackground,
  );
  const tiktokAccountUrl = normalizeTikTokAccountUrl(
    row.tiktok_account_url,
  );

  return {
    siteName,
    primaryColor,
    accentColor,
    headerLinkColor,
    headerLinkHoverColor,
    footerLinkColor,
    footerLinkHoverColor,
    bankHighlightColor,
    logoBackground,
    logoImage: normalizeImage(
      row.logo_image_path,
      row.logo_image_url,
      `${siteName} logo`,
      DEFAULT_SITE_SETTINGS.logoImage,
    ),
    heroImage: normalizeImage(
      row.hero_image_path,
      row.hero_image_url,
      normalizeRequiredText(row.hero_image_alt, DEFAULT_SITE_SETTINGS.heroImage.alt),
      DEFAULT_SITE_SETTINGS.heroImage,
    ),
    bank: {
      accountName: normalizeRequiredText(
        row.bank_account_name,
        DEFAULT_SITE_SETTINGS.bank.accountName,
      ),
      bankName: normalizeRequiredText(
        row.bank_name,
        DEFAULT_SITE_SETTINGS.bank.bankName,
      ),
      accountNumber: normalizeRequiredText(
        row.bank_account_number,
        DEFAULT_SITE_SETTINGS.bank.accountNumber,
      ),
    },
    contact: {
      phoneContacts: normalizePhoneContacts(
        row.phone_contacts,
        DEFAULT_SITE_SETTINGS.contact.phoneContacts,
      ),
      messengerUrl: normalizeUrl(
        row.messenger_url,
        DEFAULT_SITE_SETTINGS.contact.messengerUrl,
      ),
      lineId: normalizeRequiredText(
        row.line_id,
        DEFAULT_SITE_SETTINGS.contact.lineId,
      ),
      lineUrl: normalizeUrl(
        row.line_url,
        DEFAULT_SITE_SETTINGS.contact.lineUrl,
      ),
    },
    seo: {
      title: normalizeRequiredText(
        row.seo_title,
        DEFAULT_SITE_SETTINGS.seo.title,
      ),
      description: normalizeRequiredText(
        row.seo_description,
        DEFAULT_SITE_SETTINGS.seo.description,
      ),
      keywords: normalizeKeywords(
        row.seo_keywords,
        DEFAULT_SITE_SETTINGS.seo.keywords,
        { allowEmpty: false },
      ),
      ogImage: normalizePublicImage(
        row.seo_og_image_url,
        normalizeRequiredText(
          row.seo_og_image_alt,
          DEFAULT_SITE_SETTINGS.seo.ogImage.alt,
        ),
        DEFAULT_SITE_SETTINGS.seo.ogImage,
      ),
      businessName: normalizeRequiredText(
        row.seo_business_name,
        DEFAULT_SITE_SETTINGS.seo.businessName,
      ),
      sameAsUrls: normalizeSameAsUrls(
        row.seo_same_as_urls,
        DEFAULT_SITE_SETTINGS.seo.sameAsUrls,
      ),
    },
    pageSeo: {
      guides: normalizeSectionSeoSettings(
        row.guides_seo_title,
        row.guides_seo_description,
        row.guides_seo_keywords,
        row.guides_seo_og_image_url,
        row.guides_seo_og_image_alt,
        DEFAULT_SITE_SETTINGS.pageSeo.guides,
      ),
      search: normalizeSectionSeoSettings(
        row.search_seo_title,
        row.search_seo_description,
        row.search_seo_keywords,
        row.search_seo_og_image_url,
        row.search_seo_og_image_alt,
        DEFAULT_SITE_SETTINGS.pageSeo.search,
      ),
      villaDetail: {
        keywords: normalizeKeywords(
          row.villa_detail_seo_keywords,
          DEFAULT_SITE_SETTINGS.pageSeo.villaDetail.keywords,
          { allowEmpty: true },
        ),
      },
    },
    tiktok: {
      accountUrl: tiktokAccountUrl,
      videos: normalizeTikTokVideosFromRow(row.tiktok_video_urls),
    },
    detailLayout: normalizeAnyDetailLayout(row.detail_layout),
  };
}

/**
 * Trims and normalizes a mutable site-settings draft before validation or
 * persistence.
 *
 * @param draft - The site-settings draft collected from the admin form.
 * @returns A normalized draft with trimmed text, lowercase colors, and empty
 * URL entries removed.
 */
export function normalizeSiteSettingsDraft(
  draft: SiteSettingsDraft,
): SiteSettingsDraft {
  return {
    siteName: draft.siteName.trim(),
    primaryColor: draft.primaryColor.trim().toLowerCase(),
    accentColor: draft.accentColor.trim().toLowerCase(),
    headerLinkColor: draft.headerLinkColor.trim().toLowerCase(),
    headerLinkHoverColor: draft.headerLinkHoverColor.trim().toLowerCase(),
    footerLinkColor: draft.footerLinkColor.trim().toLowerCase(),
    footerLinkHoverColor: draft.footerLinkHoverColor.trim().toLowerCase(),
    bankHighlightColor: draft.bankHighlightColor.trim().toLowerCase(),
    logoBackground: normalizeSiteLogoBackground(
      draft.logoBackground,
      DEFAULT_SITE_SETTINGS.logoBackground,
    ),
    heroImageAlt: draft.heroImageAlt.trim(),
    bankAccountName: draft.bankAccountName.trim(),
    bankName: draft.bankName.trim(),
    bankAccountNumber: draft.bankAccountNumber.trim(),
    phoneContacts: draft.phoneContacts.map((contact) => ({
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      time: contact.time.trim(),
    })),
    messengerUrl: draft.messengerUrl.trim(),
    lineId: draft.lineId.trim(),
    lineUrl: draft.lineUrl.trim(),
    seoTitle: draft.seoTitle.trim(),
    seoDescription: draft.seoDescription.trim(),
    seoKeywords: normalizeKeywordList(draft.seoKeywords),
    seoOgImageUrl: normalizeLegacySeoImageUrl(draft.seoOgImageUrl),
    seoOgImageAlt: draft.seoOgImageAlt.trim(),
    seoBusinessName: draft.seoBusinessName.trim(),
    seoSameAsUrls: draft.seoSameAsUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    searchSeoTitle: draft.searchSeoTitle?.trim() ?? "",
    searchSeoDescription: draft.searchSeoDescription?.trim() ?? "",
    searchSeoKeywords: normalizeKeywordList(draft.searchSeoKeywords ?? []),
    searchSeoOgImageUrl: normalizeLegacySeoImageUrl(
      draft.searchSeoOgImageUrl ?? "",
    ),
    searchSeoOgImageAlt: draft.searchSeoOgImageAlt?.trim() ?? "",
    guidesSeoTitle: draft.guidesSeoTitle?.trim() ?? "",
    guidesSeoDescription: draft.guidesSeoDescription?.trim() ?? "",
    guidesSeoKeywords: normalizeKeywordList(draft.guidesSeoKeywords ?? []),
    guidesSeoOgImageUrl: normalizeLegacySeoImageUrl(
      draft.guidesSeoOgImageUrl ?? "",
    ),
    guidesSeoOgImageAlt: draft.guidesSeoOgImageAlt?.trim() ?? "",
    villaDetailSeoKeywords: normalizeKeywordList(draft.villaDetailSeoKeywords ?? []),
    tiktokAccountUrl: draft.tiktokAccountUrl.trim(),
    tiktokVideoUrls: draft.tiktokVideoUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
  };
}

export interface TikTokSettingsDraftInput {
  accountUrl: string;
  videoUrls: string[];
}

/**
 * Trims TikTok settings input before validation or persistence.
 *
 * @param draft - The TikTok settings draft from the admin form.
 * @returns The normalized TikTok draft with empty video entries removed.
 */
export function normalizeTikTokSettingsDraft(
  draft: TikTokSettingsDraftInput,
): TikTokSettingsDraftInput {
  return {
    accountUrl: draft.accountUrl.trim(),
    videoUrls: draft.videoUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
  };
}

/**
 * Validates TikTok account and video URL input from the admin form.
 *
 * @param draft - The TikTok settings draft to validate.
 * @returns User-facing validation error messages for invalid TikTok fields.
 */
export function validateTikTokSettingsDraft(
  draft: TikTokSettingsDraftInput,
): string[] {
  const errors: string[] = [];
  const trimmedTiktokAccountUrl = draft.accountUrl.trim();

  if (trimmedTiktokAccountUrl.length === 0) {
    if (draft.videoUrls.some((videoUrl) => videoUrl.trim().length > 0)) {
      errors.push(
        "ต้องใส่ลิงก์บัญชี TikTok เมื่อใส่วิดีโอ TikTok",
      );
    }
  } else if (!isValidTikTokAccountUrl(trimmedTiktokAccountUrl)) {
    errors.push(
      "ลิงก์บัญชี TikTok ต้องเป็น URL โปรไฟล์ TikTok เช่น https://www.tiktok.com/@baanpoolvilla",
    );
  }

  draft.videoUrls.forEach((videoUrl, index) => {
    const trimmedUrl = videoUrl.trim();

    if (trimmedUrl.length === 0) {
      return;
    }

    if (!isValidTikTokVideoUrl(trimmedUrl)) {
      errors.push(
        `ลิงก์วิดีโอ TikTok รายการที่ ${index + 1} ต้องเป็นลิงก์วิดีโอแบบเต็ม เช่น https://www.tiktok.com/@account/video/1234567890`,
      );
    }
  });

  return errors;
}

/**
 * Validates the full site-settings draft and returns admin-facing error
 * messages for invalid fields.
 *
 * @param draft - The normalized site-settings draft to validate.
 * @returns User-facing validation error messages, or an empty array when valid.
 */
export function validateSiteSettingsDraft(
  draft: SiteSettingsDraft,
): string[] {
  const errors: string[] = [];

  if (draft.siteName.trim().length === 0) {
    errors.push("ต้องใส่ชื่อเว็บ");
  }

  if (!isHexColor(draft.primaryColor)) {
    errors.push("สีหลักต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.accentColor)) {
    errors.push("สีเน้นต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.headerLinkColor)) {
    errors.push("สีเมนูใน Header ต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.headerLinkHoverColor)) {
    errors.push("สี Hover เมนูใน Header ต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.footerLinkColor)) {
    errors.push("สีเมนูใน Footer ต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.footerLinkHoverColor)) {
    errors.push("สี Hover เมนูใน Footer ต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isHexColor(draft.bankHighlightColor)) {
    errors.push("สีไฮไลท์บัญชีต้องเป็นค่าสีแบบ #RRGGBB");
  }

  if (!isSiteLogoBackground(draft.logoBackground)) {
    errors.push("พื้นหลังโลโก้ต้องเป็น ขาว, โปร่งใส, สีหลัก หรือสีอ่อน");
  }

  if (draft.heroImageAlt.length > HERO_IMAGE_ALT_MAX_LENGTH) {
    errors.push("คำอธิบายรูป Hero ต้องไม่เกิน 160 ตัวอักษร");
  }

  if (draft.seoTitle.trim().length === 0) {
    errors.push("ต้องใส่ชื่อหน้าที่แสดงบน Google");
  } else if (draft.seoTitle.length > SEO_TITLE_MAX_LENGTH) {
    errors.push("ชื่อหน้าที่แสดงบน Google ต้องไม่เกิน 80 ตัวอักษร");
  }

  if (draft.seoDescription.trim().length === 0) {
    errors.push("ต้องใส่คำอธิบายเว็บที่แสดงบน Google");
  } else if (draft.seoDescription.length > SEO_DESCRIPTION_MAX_LENGTH) {
    errors.push("คำอธิบายเว็บที่แสดงบน Google ต้องไม่เกิน 180 ตัวอักษร");
  }

  errors.push(
    ...validateKeywordList({
      keywords: draft.seoKeywords,
      label: "หน้าแรก / ค่าเริ่มต้น",
      requireOne: true,
    }),
  );

  if (!isPublicImageUrl(draft.seoOgImageUrl)) {
    errors.push("รูปตัวอย่างตอนแชร์ลิงก์ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /");
  }

  if (draft.seoOgImageAlt.trim().length === 0) {
    errors.push("ต้องใส่คำอธิบายรูปตอนแชร์ลิงก์");
  } else if (draft.seoOgImageAlt.length > SEO_IMAGE_ALT_MAX_LENGTH) {
    errors.push("คำอธิบายรูปตอนแชร์ลิงก์ต้องไม่เกิน 160 ตัวอักษร");
  }

  if (draft.seoBusinessName.trim().length === 0) {
    errors.push("ต้องใส่ชื่อธุรกิจสำหรับ SEO");
  } else if (draft.seoBusinessName.length > SEO_BUSINESS_NAME_MAX_LENGTH) {
    errors.push("ชื่อธุรกิจสำหรับ SEO ต้องไม่เกิน 100 ตัวอักษร");
  }

  if (draft.seoSameAsUrls.length > SEO_SAME_AS_URLS_MAX_COUNT) {
    errors.push("ลิงก์โซเชียลของร้านต้องไม่เกิน 6 รายการ");
  }

  draft.seoSameAsUrls.forEach((url, index) => {
    if (!isHttpUrl(url)) {
      errors.push(`ลิงก์โซเชียลของร้านรายการที่ ${index + 1} ต้องเป็น URL แบบ http หรือ https`);
    }
  });

  errors.push(
    ...validateSectionSeoFields({
      description: draft.searchSeoDescription ?? "",
      imageAlt: draft.searchSeoOgImageAlt ?? "",
      imageUrl: draft.searchSeoOgImageUrl ?? "",
      keywords: draft.searchSeoKeywords ?? [],
      label: "หน้าค้นหา (/search)",
      title: draft.searchSeoTitle ?? "",
    }),
  );
  errors.push(
    ...validateSectionSeoFields({
      description: draft.guidesSeoDescription ?? "",
      imageAlt: draft.guidesSeoOgImageAlt ?? "",
      imageUrl: draft.guidesSeoOgImageUrl ?? "",
      keywords: draft.guidesSeoKeywords ?? [],
      label: "หน้าบทความ (/guides)",
      title: draft.guidesSeoTitle ?? "",
    }),
  );
  errors.push(
    ...validateKeywordList({
      keywords: draft.villaDetailSeoKeywords ?? [],
      label: "หน้ารายละเอียดบ้าน",
      requireOne: false,
    }),
  );

  if (draft.bankAccountName.trim().length === 0) {
    errors.push("ต้องใส่ชื่อบัญชีธนาคาร");
  }

  if (draft.bankName.trim().length === 0) {
    errors.push("ต้องใส่ชื่อธนาคาร");
  }

  if (draft.bankAccountNumber.trim().length === 0) {
    errors.push("ต้องใส่เลขบัญชีธนาคาร");
  }

  if (draft.phoneContacts.length === 0) {
    errors.push("ต้องใส่เบอร์โทรอย่างน้อย 1 รายการ");
  }

  draft.phoneContacts.forEach((contact, index) => {
    const contactNumber = index + 1;

    if (contact.name.trim().length === 0) {
      errors.push(`ต้องใส่ชื่อผู้ติดต่อคนที่ ${contactNumber}`);
    }

    if (contact.phone.trim().length === 0) {
      errors.push(`ต้องใส่เบอร์โทรผู้ติดต่อคนที่ ${contactNumber}`);
    } else if (!isThaiPhoneNumber(contact.phone)) {
      errors.push(`เบอร์โทรผู้ติดต่อคนที่ ${contactNumber} ต้องเป็นเบอร์ไทย 10 หลัก เช่น 0xxxxxxxxx`);
    }

    if (contact.time.trim().length === 0) {
      errors.push(`ต้องใส่ช่วงเวลาผู้ติดต่อคนที่ ${contactNumber}`);
    }
  });

  if (!isHttpUrl(draft.messengerUrl)) {
    errors.push("ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https");
  }

  if (draft.lineId.trim().length === 0) {
    errors.push("ต้องใส่ LINE ID");
  }

  if (!isHttpUrl(draft.lineUrl)) {
    errors.push("ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https");
  }

  errors.push(
    ...validateTikTokSettingsDraft({
      accountUrl: draft.tiktokAccountUrl,
      videoUrls: draft.tiktokVideoUrls,
    }),
  );

  return errors;
}

/**
 * Validates uploaded site-asset metadata before a logo or hero image is saved.
 *
 * @param assetType - The asset type used to tailor error messages.
 * @param mimeType - The uploaded file MIME type.
 * @param sizeBytes - The uploaded file size in bytes.
 * @returns User-facing validation error messages for invalid upload metadata.
 */
export function validateUploadMetadata(
  assetType: SiteAssetType,
  mimeType: string,
  sizeBytes: number,
  fileName: string,
): string[] {
  const errors: string[] = [];
  const label = getUploadAssetLabel(assetType);
  const extension = fileName.trim().split(".").pop()?.toLowerCase() ?? "";

  if (!SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    errors.push(`ไฟล์${label}ต้องเป็น JPG, PNG หรือ WebP`);
  }

  if (!SITE_SETTINGS_ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    errors.push(`นามสกุลไฟล์${label}ต้องเป็น .jpg, .jpeg, .png หรือ .webp`);
  }

  if (sizeBytes > SITE_SETTINGS_UPLOAD_LIMIT_BYTES) {
    errors.push(`ไฟล์${label}ต้องมีขนาดไม่เกิน 6MB`);
  }

  return errors;
}

function getUploadAssetLabel(assetType: SiteAssetType): string {
  switch (assetType) {
    case "logo":
      return "โลโก้";
    case "hero":
      return "Hero";
    case "seo-og":
      return "รูปแชร์ SEO หน้าแรก";
    case "search-seo-og":
      return "รูปแชร์ SEO หน้าค้นหา";
    case "guides-seo-og":
      return "รูปแชร์ SEO หน้าบทความ";
  }
}

/**
 * Chooses older non-current uploads that can be removed while keeping the most
 * recent retained uploads for each asset type.
 *
 * @param uploads - The recorded upload history for site assets.
 * @returns Upload records eligible for cleanup.
 */
export function selectAssetUploadsForCleanup(
  uploads: SiteAssetUploadRecord[],
): SiteAssetUploadRecord[] {
  const cleanupCandidates: SiteAssetUploadRecord[] = [];

  SITE_ASSET_TYPES.forEach((assetType) => {
    const sortedUploads = uploads
      .filter((upload) => upload.assetType === assetType)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const retainedIds = new Set(
      sortedUploads
        .slice(0, RETAINED_UPLOADS_PER_ASSET_TYPE)
        .map((upload) => upload.id),
    );

    sortedUploads.forEach((upload) => {
      if (!upload.isCurrent && !retainedIds.has(upload.id)) {
        cleanupCandidates.push(upload);
      }
    });
  });

  return cleanupCandidates;
}

function normalizeRequiredText(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : fallback;
}

function normalizeColor(value: string | null | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  return isHexColor(trimmedValue) ? trimmedValue.toLowerCase() : fallback;
}

function normalizeImage(
  path: string | null,
  url: string | null,
  alt: string,
  fallback: SiteImageSettings,
): SiteImageSettings {
  const trimmedPath = path?.trim() ?? "";
  const trimmedUrl = url?.trim() ?? "";

  if (
    trimmedPath.length === 0 ||
    trimmedUrl.length === 0 ||
    !isPublicImageUrl(trimmedUrl)
  ) {
    return fallback;
  }

  return {
    path: trimmedPath,
    url: trimmedUrl,
    alt,
  };
}

function normalizePublicImage(
  url: string | null | undefined,
  alt: string,
  fallback: SiteImageSettings,
): SiteImageSettings {
  const trimmedUrl = normalizeLegacySeoImageUrl(url ?? "");

  if (!isPublicImageUrl(trimmedUrl)) {
    return fallback;
  }

  return {
    path: trimmedUrl,
    url: trimmedUrl,
    alt,
  };
}

function normalizeLegacySeoImageUrl(value: string): string {
  const trimmedValue = value.trim();

  return trimmedValue === LEGACY_WORDPRESS_OG_IMAGE_URL
    ? DEFAULT_SITE_SETTINGS.seo.ogImage.url
    : trimmedValue;
}

function normalizeSectionSeoSettings(
  title: string | null | undefined,
  description: string | null | undefined,
  keywords: unknown,
  imageUrl: string | null | undefined,
  imageAlt: string | null | undefined,
  fallback: SiteSettings["pageSeo"]["search"],
) {
  return {
    title: normalizeRequiredText(title, fallback.title),
    description: normalizeRequiredText(description, fallback.description),
    keywords: normalizeKeywords(keywords, fallback.keywords, { allowEmpty: true }),
    ogImage: normalizePublicImage(
      imageUrl,
      normalizeRequiredText(imageAlt, fallback.ogImage.alt),
      fallback.ogImage,
    ),
  };
}

interface SectionSeoValidationInput {
  description: string;
  imageAlt: string;
  imageUrl: string;
  keywords: string[];
  label: string;
  title: string;
}

function validateSectionSeoFields({
  description,
  imageAlt,
  imageUrl,
  keywords,
  label,
  title,
}: SectionSeoValidationInput): string[] {
  const errors: string[] = [];

  if (title.trim().length === 0) {
    errors.push(`ต้องใส่ชื่อหน้า SEO ของ${label}`);
  } else if (title.length > SEO_TITLE_MAX_LENGTH) {
    errors.push(`ชื่อหน้า SEO ของ${label}ต้องไม่เกิน 80 ตัวอักษร`);
  }

  if (description.trim().length === 0) {
    errors.push(`ต้องใส่คำอธิบาย SEO ของ${label}`);
  } else if (description.length > SEO_DESCRIPTION_MAX_LENGTH) {
    errors.push(`คำอธิบาย SEO ของ${label}ต้องไม่เกิน 180 ตัวอักษร`);
  }

  if (!isPublicImageUrl(imageUrl)) {
    errors.push(`รูปแชร์ลิงก์ของ${label}ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /`);
  }

  if (imageAlt.trim().length === 0) {
    errors.push(`ต้องใส่คำอธิบายรูปแชร์ลิงก์ของ${label}`);
  } else if (imageAlt.length > SEO_IMAGE_ALT_MAX_LENGTH) {
    errors.push(`คำอธิบายรูปแชร์ลิงก์ของ${label}ต้องไม่เกิน 160 ตัวอักษร`);
  }

  errors.push(
    ...validateKeywordList({
      keywords,
      label,
      requireOne: false,
    }),
  );

  return errors;
}

function normalizeKeywords(
  value: unknown,
  fallback: string[],
  { allowEmpty }: { allowEmpty: boolean },
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const keywords = normalizeKeywordList(
    value.filter((item): item is string => typeof item === "string"),
  );

  return keywords.length > 0 || allowEmpty ? keywords : fallback;
}

function normalizeKeywordList(keywords: string[]): string[] {
  return [
    ...new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0),
    ),
  ];
}

function validateKeywordList({
  keywords,
  label,
  requireOne,
}: {
  keywords: string[];
  label: string;
  requireOne: boolean;
}): string[] {
  const errors: string[] = [];

  if (requireOne && keywords.length === 0) {
    errors.push(`ต้องใส่คำค้น SEO ของ${label}อย่างน้อย 1 รายการ`);
  }

  if (keywords.length > SEO_KEYWORDS_MAX_COUNT) {
    errors.push(`คำค้น SEO ของ${label}ต้องไม่เกิน ${SEO_KEYWORDS_MAX_COUNT} รายการ`);
  }

  keywords.forEach((keyword, index) => {
    const keywordNumber = index + 1;

    if (keyword.length < SEO_KEYWORD_MIN_LENGTH) {
      errors.push(`คำค้น SEO ของ${label}รายการที่ ${keywordNumber} ต้องมีอย่างน้อย 2 ตัวอักษร`);
    } else if (keyword.length > SEO_KEYWORD_MAX_LENGTH) {
      errors.push(`คำค้น SEO ของ${label}รายการที่ ${keywordNumber} ต้องไม่เกิน 60 ตัวอักษร`);
    }

    if (hasUnsafeKeywordCharacters(keyword)) {
      errors.push(`คำค้น SEO ของ${label}รายการที่ ${keywordNumber} ห้ามมีเครื่องหมาย <, > หรืออักขระควบคุม`);
    }
  });

  return errors;
}

function hasUnsafeKeywordCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (character === "<" || character === ">") {
      return true;
    }

    if (
      codePoint !== undefined &&
      ((codePoint >= 0 && codePoint <= 8) ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeTikTokVideosFromRow(
  value: unknown,
): SiteTikTokVideoSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const videos = value
    .filter((item): item is string => typeof item === "string")
    .map((url) => url.trim())
    .map((url) => {
      const videoId = parseTikTokVideoId(url);

      if (videoId === null) {
        return null;
      }

      return {
        url,
        videoId,
      };
    })
    .filter((video): video is SiteTikTokVideoSettings => video !== null);

  return videos;
}

function normalizeTikTokAccountUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  return isValidTikTokAccountUrl(trimmed) ? trimmed : "";
}

function isValidTikTokAccountUrl(value: string): boolean {
  const videoId = parseTikTokVideoId(value);

  return videoId === null && isValidTikTokHostAndPath(value, TIKTOK_PROFILE_PATH_PATTERN);
}

function isValidTikTokVideoUrl(value: string): boolean {
  return parseTikTokVideoId(value) !== null;
}

function parseTikTokVideoId(value: string): string | null {
  const parsed = parseTikTokUrl(value);

  if (parsed === null) {
    return null;
  }

  const profileMatch = TIKTOK_PROFILE_VIDEO_PATH_PATTERN.exec(parsed.pathname);
  if (profileMatch) {
    const videoId = profileMatch[1];
    if (videoId && TIKTOK_VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  const playerMatch = TIKTOK_PLAYER_VIDEO_PATH_PATTERN.exec(parsed.pathname);
  if (playerMatch) {
    const videoId = playerMatch[1];
    if (videoId && TIKTOK_VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  return null;
}

function isValidTikTokHostAndPath(
  value: string,
  pathPattern: RegExp,
): boolean {
  const parsed = parseTikTokUrl(value);

  if (parsed === null) {
    return false;
  }

  return (
    TIKTOK_HOSTS.has(parsed.hostname.toLowerCase()) &&
    pathPattern.test(parsed.pathname)
  );
}

function parseTikTokUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (!TIKTOK_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    if (url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function normalizePhoneContacts(
  value: unknown,
  fallback: SitePhoneContact[],
): SitePhoneContact[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const contacts = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const contact = item as Partial<Record<keyof SitePhoneContact, unknown>>;

      if (
        typeof contact.name !== "string" ||
        typeof contact.phone !== "string" ||
        typeof contact.time !== "string"
      ) {
        return null;
      }

      return {
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        time: contact.time.trim(),
      };
    })
    .filter((contact): contact is SitePhoneContact => {
      return (
        contact !== null &&
        contact.name.length > 0 &&
        contact.phone.length > 0 &&
        contact.time.length > 0
      );
    });

  return contacts.length > 0 ? contacts : fallback;
}

function normalizeSameAsUrls(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const urls = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && isHttpUrl(item));

  return urls.length > 0 ? [...new Set(urls)] : fallback;
}

function normalizeThaiPhoneDigits(value: string): string {
  return value.replaceAll(" ", "").replaceAll("-", "");
}

function isThaiPhoneNumber(value: string): boolean {
  return THAI_PHONE_PATTERN.test(normalizeThaiPhoneDigits(value));
}

function normalizeUrl(value: string | null | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  return isHttpUrl(trimmedValue) ? trimmedValue : fallback;
}

function isPublicImageUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      isAllowedPublicImageHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

