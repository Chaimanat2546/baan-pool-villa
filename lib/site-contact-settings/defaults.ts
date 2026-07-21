import type { SiteContactSettings } from "./types";

export const DEFAULT_SITE_CONTACT_SETTINGS: SiteContactSettings = {
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
      {
        name: "คุณโก้",
        phone: "0657329919",
        time: "ช่วง 16.00-02.00",
      },
    ],
    messengerUrl: "https://www.facebook.com/baanpoolvillas",
    lineId: "@baanpoolvilla",
    lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
  },
};

export function cloneDefaultSiteContactSettings(): SiteContactSettings {
  return {
    bank: { ...DEFAULT_SITE_CONTACT_SETTINGS.bank },
    contact: {
      ...DEFAULT_SITE_CONTACT_SETTINGS.contact,
      phoneContacts: DEFAULT_SITE_CONTACT_SETTINGS.contact.phoneContacts.map(
        (contact) => ({ ...contact }),
      ),
    },
  };
}
