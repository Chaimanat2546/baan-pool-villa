import type { SitePhoneContact } from "./types";

export type PhoneContactsFieldResult =
  | {
      ok: true;
      value: SitePhoneContact[];
    }
  | {
      ok: false;
      error: string;
    };

const INVALID_PHONE_CONTACTS_ERROR = "ข้อมูลเบอร์โทรติดต่อไม่ถูกต้อง";

export function readStringField(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

export function readPhoneContactsField(
  formData: FormData,
): PhoneContactsFieldResult {
  const rawValue = readStringField(formData, "phoneContacts");

  if (!rawValue) {
    return { ok: true, value: [] };
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return { ok: false, error: INVALID_PHONE_CONTACTS_ERROR };
    }

    const phoneContacts: SitePhoneContact[] = [];

    for (const item of parsedValue) {
      if (!item || typeof item !== "object") {
        return { ok: false, error: INVALID_PHONE_CONTACTS_ERROR };
      }

      const contact = item as Partial<Record<keyof SitePhoneContact, unknown>>;

      if (
        typeof contact.name !== "string" ||
        typeof contact.phone !== "string" ||
        typeof contact.time !== "string"
      ) {
        return { ok: false, error: INVALID_PHONE_CONTACTS_ERROR };
      }

      phoneContacts.push({
        name: contact.name,
        phone: contact.phone,
        time: contact.time,
      });
    }

    return { ok: true, value: phoneContacts };
  } catch {
    return { ok: false, error: INVALID_PHONE_CONTACTS_ERROR };
  }
}

export function readStringArrayField(
  formData: FormData,
  fieldName: string,
): string[] {
  const rawValue = readStringField(formData, fieldName);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((item) => (typeof item === "string" ? item : ""));
  } catch {
    return splitDelimitedString(rawValue);
  }
}

function splitDelimitedString(value: string): string[] {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", ",")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getOptionalUpload(formData: FormData, fieldName: string): File | null {
  const value = formData.get(fieldName);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}
