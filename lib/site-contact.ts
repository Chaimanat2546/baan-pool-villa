import { DEFAULT_SITE_CONTACT_SETTINGS } from "./site-contact-settings/defaults";
import type {
  SiteContactChannels,
  SitePhoneContact,
} from "./site-contact-settings/types";

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

export function buildContactLinks(contact: SiteContactChannels) {
  return {
    messenger: contact.messengerUrl,
    line: contact.lineUrl,
  };
}

export const phoneContacts = DEFAULT_SITE_CONTACT_SETTINGS.contact.phoneContacts.map(
  withPhoneHref,
);

export const contactLinks = buildContactLinks(DEFAULT_SITE_CONTACT_SETTINGS.contact);
