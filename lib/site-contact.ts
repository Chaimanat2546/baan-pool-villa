import { DEFAULT_SITE_CONTACT_SETTINGS } from "./site-settings/defaults";
import type { SiteContactSettings, SitePhoneContact } from "./site-settings/types";

export function buildPhoneHref(phone: string): string {
  let digits = "";

  for (const character of phone) {
    if (character >= "0" && character <= "9") {
      digits += character;
    }
  }

  return digits ? `tel:${digits}` : "#";
}

export function withPhoneHref(contact: SitePhoneContact) {
  return {
    ...contact,
    href: buildPhoneHref(contact.phone),
  };
}

export function buildContactLinks(contact: SiteContactSettings) {
  return {
    messenger: contact.messengerUrl,
    line: contact.lineUrl,
  };
}

export const phoneContacts = DEFAULT_SITE_CONTACT_SETTINGS.phoneContacts.map(
  withPhoneHref,
);

export const contactLinks = buildContactLinks(DEFAULT_SITE_CONTACT_SETTINGS);
