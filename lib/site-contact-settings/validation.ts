import {
  DEFAULT_SITE_CONTACT_SETTINGS,
  cloneDefaultSiteContactSettings,
} from "./defaults";
import type {
  SiteContactSettings,
  SiteContactSettingsDraft,
  SiteContactSettingsRow,
  SitePhoneContact,
} from "./types";

const THAI_PHONE_PATTERN = /^0\d{9}$/;

function requiredText(value: string | null, fallback: string): string {
  return value?.trim() || fallback;
}

function httpUrl(value: string | null, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;

  try {
    const protocol = new URL(normalized).protocol;
    return protocol === "http:" || protocol === "https:" ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function phoneContacts(value: unknown): SitePhoneContact[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const normalized = value.flatMap((contact) => {
    if (!contact || typeof contact !== "object") return [];
    const raw = contact as Record<string, unknown>;
    if (
      typeof raw.name !== "string" ||
      typeof raw.phone !== "string" ||
      typeof raw.time !== "string"
    ) {
      return [];
    }
    const mapped = {
      name: raw.name.trim(),
      phone: raw.phone.trim(),
      time: raw.time.trim(),
    };
    return mapped.name && mapped.phone && mapped.time ? [mapped] : [];
  });

  return normalized.length === value.length ? normalized : null;
}

export function normalizeSiteContactSettingsRow(
  row: SiteContactSettingsRow | null,
): SiteContactSettings {
  if (!row) return cloneDefaultSiteContactSettings();

  return {
    bank: {
      accountName: requiredText(
        row.bank_account_name,
        DEFAULT_SITE_CONTACT_SETTINGS.bank.accountName,
      ),
      bankName: requiredText(
        row.bank_name,
        DEFAULT_SITE_CONTACT_SETTINGS.bank.bankName,
      ),
      accountNumber: requiredText(
        row.bank_account_number,
        DEFAULT_SITE_CONTACT_SETTINGS.bank.accountNumber,
      ),
    },
    contact: {
      phoneContacts:
        phoneContacts(row.phone_contacts) ??
        cloneDefaultSiteContactSettings().contact.phoneContacts,
      messengerUrl: httpUrl(
        row.messenger_url,
        DEFAULT_SITE_CONTACT_SETTINGS.contact.messengerUrl,
      ),
      showFacebookTimeline:
        typeof row.show_facebook_timeline === "boolean"
          ? row.show_facebook_timeline
          : DEFAULT_SITE_CONTACT_SETTINGS.contact.showFacebookTimeline,
      lineId: requiredText(
        row.line_id,
        DEFAULT_SITE_CONTACT_SETTINGS.contact.lineId,
      ),
      lineUrl: httpUrl(
        row.line_url,
        DEFAULT_SITE_CONTACT_SETTINGS.contact.lineUrl,
      ),
    },
  };
}

export function normalizeSiteContactSettingsDraft(
  draft: SiteContactSettingsDraft,
): SiteContactSettingsDraft {
  return {
    bankAccountName: draft.bankAccountName.trim(),
    bankName: draft.bankName.trim(),
    bankAccountNumber: draft.bankAccountNumber.trim(),
    phoneContacts: draft.phoneContacts.map((contact) => ({
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      time: contact.time.trim(),
    })),
    messengerUrl: draft.messengerUrl.trim(),
    showFacebookTimeline: draft.showFacebookTimeline,
    lineId: draft.lineId.trim(),
    lineUrl: draft.lineUrl.trim(),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function validateSiteContactSettingsDraft(
  draft: SiteContactSettingsDraft,
): string[] {
  const errors: string[] = [];
  if (!draft.bankAccountName.trim()) errors.push("ต้องใส่ชื่อบัญชีธนาคาร");
  if (!draft.bankName.trim()) errors.push("ต้องใส่ชื่อธนาคาร");
  if (!draft.bankAccountNumber.trim()) errors.push("ต้องใส่เลขบัญชีธนาคาร");
  if (!draft.phoneContacts.length) errors.push("ต้องใส่เบอร์โทรอย่างน้อย 1 รายการ");
  draft.phoneContacts.forEach((contact, index) => {
    const number = index + 1;
    if (!contact.name.trim()) errors.push(`ต้องใส่ชื่อผู้ติดต่อคนที่ ${number}`);
    if (!contact.phone.trim()) {
      errors.push(`ต้องใส่เบอร์โทรผู้ติดต่อคนที่ ${number}`);
    } else if (!THAI_PHONE_PATTERN.test(contact.phone.replace(/\D/g, ""))) {
      errors.push(`เบอร์โทรผู้ติดต่อคนที่ ${number} ต้องเป็นเบอร์ไทย 10 หลัก เช่น 0xxxxxxxxx`);
    }
    if (!contact.time.trim()) errors.push(`ต้องใส่ช่วงเวลาผู้ติดต่อคนที่ ${number}`);
  });
  if (!isHttpUrl(draft.messengerUrl)) {
    errors.push("ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https");
  }
  if (!draft.lineId.trim()) errors.push("ต้องใส่ LINE ID");
  if (!isHttpUrl(draft.lineUrl)) {
    errors.push("ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https");
  }
  return errors;
}
