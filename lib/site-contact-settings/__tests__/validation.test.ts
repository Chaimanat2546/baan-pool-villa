import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_CONTACT_SETTINGS,
  cloneDefaultSiteContactSettings,
} from "../defaults";
import type {
  SiteContactSettingsDraft,
  SiteContactSettingsRow,
} from "../types";
import {
  normalizeSiteContactSettingsDraft,
  normalizeSiteContactSettingsRow,
  validateSiteContactSettingsDraft,
} from "../validation";

const validDraft: SiteContactSettingsDraft = {
  bankAccountName: "Account Name",
  bankName: "Bank Name",
  bankAccountNumber: "123-4-56789-0",
  phoneContacts: [{ name: "Game", phone: "0617485213", time: "07.00-15.00" }],
  messengerUrl: "https://www.facebook.com/baanpoolvillas",
  facebookPageName: "พี่หมี พูลวิลล่าพัทยา",
  showFacebookTimeline: true,
  lineId: "@baanpoolvilla",
  lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
};

function row(overrides: Partial<SiteContactSettingsRow> = {}): SiteContactSettingsRow {
  return {
    singleton_id: true,
    bank_account_name: " Account Name ",
    bank_name: " Bank Name ",
    bank_account_number: " 123-4-56789-0 ",
    phone_contacts: [
      { name: " Game ", phone: " 0617485213 ", time: " 07.00-15.00 " },
    ],
    messenger_url: " https://www.facebook.com/baanpoolvillas ",
    facebook_page_name: " พี่หมี พูลวิลล่าพัทยา ",
    show_facebook_timeline: false,
    line_id: " @baanpoolvilla ",
    line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
    ...overrides,
  };
}

describe("site contact settings validation", () => {
  it("maps and trims every contact column", () => {
    expect(normalizeSiteContactSettingsRow(row())).toEqual({
      bank: {
        accountName: "Account Name",
        bankName: "Bank Name",
        accountNumber: "123-4-56789-0",
      },
      contact: {
        phoneContacts: [
          { name: "Game", phone: "0617485213", time: "07.00-15.00" },
        ],
        messengerUrl: "https://www.facebook.com/baanpoolvillas",
        facebookPageName: "พี่หมี พูลวิลล่าพัทยา",
        showFacebookTimeline: false,
        lineId: "@baanpoolvilla",
        lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      },
    });
  });

  it("falls back for unsafe links and malformed phone arrays", () => {
    expect(
      normalizeSiteContactSettingsRow(
        row({
          messenger_url: "javascript:alert(1)",
          line_url: "file:///tmp/line",
          phone_contacts: { phone: "0617485213" },
        }),
      ),
    ).toMatchObject({
      contact: {
        ...DEFAULT_SITE_CONTACT_SETTINGS.contact,
        facebookPageName: "พี่หมี พูลวิลล่าพัทยา",
        showFacebookTimeline: false,
      },
    });
  });

  it("normalizes drafts and preserves current validation rules", () => {
    const normalized = normalizeSiteContactSettingsDraft({
      ...validDraft,
      bankAccountName: " Account Name ",
      phoneContacts: [
        { name: " Game ", phone: " 0617485213 ", time: " 07.00-15.00 " },
      ],
    });

    expect(normalized.bankAccountName).toBe("Account Name");
    expect(normalized.phoneContacts[0]).toEqual({
      name: "Game",
      phone: "0617485213",
      time: "07.00-15.00",
    });
    expect(normalized.showFacebookTimeline).toBe(true);
    expect(normalized.facebookPageName).toBe("พี่หมี พูลวิลล่าพัทยา");
    expect(validateSiteContactSettingsDraft(normalized)).toEqual([]);
    expect(
      validateSiteContactSettingsDraft({
        ...normalized,
        messengerUrl: "javascript:alert(1)",
        phoneContacts: [{ ...normalized.phoneContacts[0], phone: "123" }],
      }),
    ).toHaveLength(2);
    expect(validateSiteContactSettingsDraft({ ...normalized, facebookPageName: "x".repeat(121) })).toContain("ชื่อเพจ Facebook ต้องมีความยาวไม่เกิน 120 ตัวอักษร");
  });

  it("rejects more than four phone contacts", () => {
    expect(
      validateSiteContactSettingsDraft({
        ...validDraft,
        phoneContacts: Array.from({ length: 5 }, (_, index) => ({
          name: `Contact ${index + 1}`,
          phone: `081234567${index}`,
          time: "09.00-18.00",
        })),
      }),
    ).toContain("ต้องมีเบอร์โทรไม่เกิน 4 รายการ");
  });

  it("clones phone contacts in the default fallback", () => {
    const first = cloneDefaultSiteContactSettings();
    const second = cloneDefaultSiteContactSettings();

    first.contact.phoneContacts[0].name = "Changed";

    expect(second).toEqual(DEFAULT_SITE_CONTACT_SETTINGS);
    expect(second.contact.phoneContacts[0].name).not.toBe("Changed");
  });
});
