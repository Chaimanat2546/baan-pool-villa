import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "./defaults";
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
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const TIKTOK_VIDEO_ID_PATTERN = /^\d{8,30}$/;
const TIKTOK_PROFILE_PATH_PATTERN = /^\/@[^/]+\/?$/;
const TIKTOK_PROFILE_VIDEO_PATH_PATTERN = /^\/@[^/]+\/video\/(\d{8,30})\/?$/;
const TIKTOK_PLAYER_VIDEO_PATH_PATTERN = /^\/player\/v1\/(\d{8,30})\/?$/;
const RETAINED_UPLOADS_PER_ASSET_TYPE = 3;

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
 * Builds a normalized SiteSettings object from a database row, applying field-level normalization and fallbacks.
 *
 * @param row - The raw site settings row from the database, or `null` to indicate no stored settings
 * @returns A normalized `SiteSettings` object. If `row` is `null` or individual fields are missing/invalid, corresponding values from `DEFAULT_SITE_SETTINGS` are used
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
  const tiktokAccountUrl = normalizeTikTokAccountUrl(
    row.tiktok_account_url,
  );

  return {
    siteName,
    primaryColor,
    accentColor,
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
        row.guides_seo_og_image_url,
        row.guides_seo_og_image_alt,
        DEFAULT_SITE_SETTINGS.pageSeo.guides,
      ),
      search: normalizeSectionSeoSettings(
        row.search_seo_title,
        row.search_seo_description,
        row.search_seo_og_image_url,
        row.search_seo_og_image_alt,
        DEFAULT_SITE_SETTINGS.pageSeo.search,
      ),
    },
    tiktok: {
      accountUrl: tiktokAccountUrl,
      videos: normalizeTikTokVideosFromRow(row.tiktok_video_urls),
    },
    detailLayout: normalizeAnyDetailLayout(row.detail_layout),
  };
}

/**
 * Trim and normalize all textual fields of a SiteSettingsDraft and remove empty URL entries.
 *
 * Produces a new draft object where string fields are trimmed (colors are lowercased),
 * each phone contact's `name`, `phone`, and `time` are trimmed, and `seoSameAsUrls` and
 * `tiktokVideoUrls` have empty strings removed.
 *
 * @param draft - The input SiteSettingsDraft to normalize
 * @returns A new SiteSettingsDraft with trimmed values, lowercase color codes, and filtered URL arrays
 */
export function normalizeSiteSettingsDraft(
  draft: SiteSettingsDraft,
): SiteSettingsDraft {
  return {
    siteName: draft.siteName.trim(),
    primaryColor: draft.primaryColor.trim().toLowerCase(),
    accentColor: draft.accentColor.trim().toLowerCase(),
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
    seoOgImageUrl: draft.seoOgImageUrl.trim(),
    seoOgImageAlt: draft.seoOgImageAlt.trim(),
    seoBusinessName: draft.seoBusinessName.trim(),
    seoSameAsUrls: draft.seoSameAsUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    searchSeoTitle: draft.searchSeoTitle?.trim() ?? "",
    searchSeoDescription: draft.searchSeoDescription?.trim() ?? "",
    searchSeoOgImageUrl: draft.searchSeoOgImageUrl?.trim() ?? "",
    searchSeoOgImageAlt: draft.searchSeoOgImageAlt?.trim() ?? "",
    guidesSeoTitle: draft.guidesSeoTitle?.trim() ?? "",
    guidesSeoDescription: draft.guidesSeoDescription?.trim() ?? "",
    guidesSeoOgImageUrl: draft.guidesSeoOgImageUrl?.trim() ?? "",
    guidesSeoOgImageAlt: draft.guidesSeoOgImageAlt?.trim() ?? "",
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
 * Normalize a TikTok settings draft by trimming text fields and removing empty video entries.
 *
 * @param draft - Input draft containing `accountUrl` and `videoUrls` to normalize
 * @returns The normalized draft with `accountUrl` trimmed and `videoUrls` containing only non-empty, trimmed URLs
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
 * Validate TikTok account and video URL fields in a TikTok settings draft.
 *
 * Validations:
 * - If any video URL is provided, an account URL must be present and must be a valid TikTok profile URL.
 * - Each non-empty video URL must be a full TikTok video URL that contains a parsable video ID.
 *
 * @param draft - Input draft containing `accountUrl` and `videoUrls` to validate
 * @returns An array of human-readable validation error messages (empty if no errors)
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
 * Validate a site settings draft and produce user-facing error messages for any invalid fields.
 *
 * Performs validations for site name, colors, hero/SEO image fields and alt text, SEO title/description/business name,
 * social "sameAs" URLs, bank account fields, phone contact entries, messenger/LINE URLs and IDs, and TikTok account/video inputs.
 *
 * @param draft - The draft object to validate
 * @returns An array of human-readable validation error messages (empty if the draft is valid)
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
      label: "หน้าค้นหา (/search)",
      title: draft.searchSeoTitle ?? "",
    }),
  );
  errors.push(
    ...validateSectionSeoFields({
      description: draft.guidesSeoDescription ?? "",
      imageAlt: draft.guidesSeoOgImageAlt ?? "",
      imageUrl: draft.guidesSeoOgImageUrl ?? "",
      label: "หน้าบทความ (/guides)",
      title: draft.guidesSeoTitle ?? "",
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
 * Validate an uploaded site image's MIME type and file size.
 *
 * @param assetType - The kind of asset (`"logo"` or `"hero"`) used to tailor error message wording
 * @param mimeType - The file MIME type to validate
 * @param sizeBytes - The file size in bytes
 * @returns An array of user-facing validation error messages; empty when the file passes both checks
 */
export function validateUploadMetadata(
  assetType: SiteAssetType,
  mimeType: string,
  sizeBytes: number,
): string[] {
  const errors: string[] = [];
  const label = assetType === "logo" ? "โลโก้" : "Hero";

  if (!SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    errors.push(`ไฟล์${label}ต้องเป็น JPG, PNG หรือ WebP`);
  }

  if (sizeBytes > SITE_SETTINGS_UPLOAD_LIMIT_BYTES) {
    errors.push(`ไฟล์${label}ต้องมีขนาดไม่เกิน 6MB`);
  }

  return errors;
}

export function selectAssetUploadsForCleanup(
  uploads: SiteAssetUploadRecord[],
): SiteAssetUploadRecord[] {
  const cleanupCandidates: SiteAssetUploadRecord[] = [];
  const assetTypes: SiteAssetType[] = ["hero", "logo"];

  assetTypes.forEach((assetType) => {
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

function normalizeColor(value: string | null, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  return isHexColor(trimmedValue) ? trimmedValue : fallback;
}

function normalizeImage(
  path: string | null,
  url: string | null,
  alt: string,
  fallback: SiteImageSettings,
): SiteImageSettings {
  const trimmedPath = path?.trim() ?? "";
  const trimmedUrl = url?.trim() ?? "";

  if (trimmedPath.length === 0 || trimmedUrl.length === 0) {
    return fallback;
  }

  return {
    path: trimmedPath,
    url: trimmedUrl,
    alt,
  };
}

/**
 * Produce a SiteImageSettings object from a public image URL or path, or return a provided fallback.
 *
 * @param url - Candidate image location; either a path starting with `/` (but not `//`) or an `http`/`https` URL
 * @param alt - The alt text to associate with the image
 * @param fallback - The value to return when `url` is not a valid public image URL
 * @returns A `SiteImageSettings` object with `path`, `url`, and `alt` derived from the validated `url`, or `fallback` if the URL is not a public image
 */
function normalizePublicImage(
  url: string | null | undefined,
  alt: string,
  fallback: SiteImageSettings,
): SiteImageSettings {
  const trimmedUrl = url?.trim() ?? "";

  if (!isPublicImageUrl(trimmedUrl)) {
    return fallback;
  }

  return {
    path: trimmedUrl,
    url: trimmedUrl,
    alt,
  };
}

function normalizeSectionSeoSettings(
  title: string | null | undefined,
  description: string | null | undefined,
  imageUrl: string | null | undefined,
  imageAlt: string | null | undefined,
  fallback: SiteSettings["pageSeo"]["search"],
) {
  return {
    title: normalizeRequiredText(title, fallback.title),
    description: normalizeRequiredText(description, fallback.description),
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
  label: string;
  title: string;
}

function validateSectionSeoFields({
  description,
  imageAlt,
  imageUrl,
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

  return errors;
}

/**
 * Normalize an array of TikTok video URL strings from a database row into structured video settings.
 *
 * @param value - The raw value from the row (expected to be an array of strings); non-array inputs or non-string entries are ignored.
 * @returns An array of objects `{ url, videoId }` for each input string that yielded a valid TikTok video ID; an empty array if none are valid.
 */
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

/**
 * Normalize a TikTok account URL into a validated profile URL or an empty string.
 *
 * @param value - The input value; null or undefined is treated as empty and the value is trimmed before validation.
 * @returns The trimmed TikTok profile URL if it is a valid account URL, otherwise an empty string.
 */
function normalizeTikTokAccountUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  return isValidTikTokAccountUrl(trimmed) ? trimmed : "";
}

/**
 * Check whether a string is a valid TikTok profile URL and not a TikTok video URL.
 *
 * @param value - The URL string to validate
 * @returns `true` if `value` is a TikTok profile URL using an allowed host and matching the profile path pattern, `false` otherwise
 */
function isValidTikTokAccountUrl(value: string): boolean {
  const videoId = parseTikTokVideoId(value);

  return videoId === null && isValidTikTokHostAndPath(value, TIKTOK_PROFILE_PATH_PATTERN);
}

/**
 * Checks whether a string is a valid TikTok video URL.
 *
 * @param value - The URL or string to validate
 * @returns `true` if the input contains a valid TikTok video identifier and matches supported TikTok video URL formats, `false` otherwise.
 */
function isValidTikTokVideoUrl(value: string): boolean {
  return parseTikTokVideoId(value) !== null;
}

/**
 * Extracts a TikTok video ID from a TikTok URL.
 *
 * @param value - The URL string to parse (TikTok profile/video or player URL)
 * @returns The extracted numeric video ID when the input is a valid TikTok video URL, `null` otherwise.
 */
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

/**
 * Checks whether a string is a TikTok URL using an allowed host and a pathname that matches a given pattern.
 *
 * @param value - The URL string to validate.
 * @param pathPattern - Regular expression to test against the parsed URL's pathname.
 * @returns `true` if `value` parses as an `http`/`https` TikTok URL whose host is in the allowed set and whose pathname matches `pathPattern`, `false` otherwise.
 */
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

/**
 * Parse a string as a URL and return it only if it is an http/https URL hosted on a recognized TikTok hostname.
 *
 * @param value - The input string to parse as a URL
 * @returns A `URL` object when `value` is a valid http/https URL whose hostname is in the TikTok host set, `null` otherwise
 */
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

/**
 * Normalize an arbitrary input into a validated array of phone contact objects or fall back.
 *
 * Trims `name`, `phone`, and `time` for each valid contact and filters out entries missing any of those fields.
 *
 * @param value - The input value to normalize (expected to be an array of objects but may be any type)
 * @param fallback - Array to return when `value` is not an array or contains no valid contacts
 * @returns An array of `SitePhoneContact` objects with trimmed `name`, `phone`, and `time` fields; returns `fallback` if no valid contacts are produced
 */
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

function normalizeUrl(value: string | null | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  return isHttpUrl(trimmedValue) ? trimmedValue : fallback;
}

function isPublicImageUrl(value: string): boolean {
  return (
    (value.startsWith("/") && !value.startsWith("//")) ||
    isHttpUrl(value)
  );
}

/**
 * Checks whether a string is a valid HTTP or HTTPS URL.
 *
 * @param value - The input string to validate as a URL
 * @returns `true` if `value` parses as a URL whose protocol is `http:` or `https:`, `false` otherwise.
 */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

