import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "./defaults";
import type {
  SiteAssetUploadRecord,
  SiteAssetType,
  SiteImageSettings,
  SitePhoneContact,
  SiteSettings,
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
const RETAINED_UPLOADS_PER_ASSET_TYPE = 3;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

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
  };
}

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
  };
}

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

  return errors;
}

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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
