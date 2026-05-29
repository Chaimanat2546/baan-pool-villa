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

function normalizeUrl(value: string | null | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  return isHttpUrl(trimmedValue) ? trimmedValue : fallback;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
