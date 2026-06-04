import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-settings/colors", () => ({
  buildSiteThemeStyle: vi.fn(),
}));

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";

import {
  buildSettingsFormData,
  extractErrors,
  mapSettingsToDraft,
  shouldRedirectToLogin,
} from "../settings-helpers";

describe("settings helpers", () => {
  it("maps editable bank and contact settings into the admin draft", () => {
    const draft = mapSettingsToDraft({
      ...DEFAULT_SITE_SETTINGS,
      siteName: "Pool Villas Pattaya",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      logoImage: {
        path: "/images/logo.jpg",
        url: "/images/logo.jpg",
        alt: "Logo",
      },
      heroImage: {
        path: "/images/hero.jpg",
        url: "/images/hero.jpg",
        alt: "Hero",
      },
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
        ],
        messengerUrl: "https://www.facebook.com/baanpoolvillas",
        lineId: "@baanpoolvilla",
        lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      },
      seo: {
        title: "Baan Pool Villa Pattaya | Private Pool Villas",
        description: "Book private pool villas in Pattaya.",
        ogImage: {
          path: "/images/seo-cover.jpg",
          url: "/images/seo-cover.jpg",
          alt: "Pool villa with private swimming pool",
        },
        businessName: "Baan Pool Villa Pattaya",
        sameAsUrls: [
          "https://www.facebook.com/baanpoolvillas",
          "https://line.me/R/ti/p/@baanpoolvilla",
        ],
      },
    });

    expect(draft).toMatchObject({
      bankAccountName: "คุณ อาภัสรา จินดาวา",
      bankName: "ธนาคารกสิกรไทย",
      bankAccountNumber: "398-289-7482",
      phoneContacts: [
        {
          name: "คุณเกม",
          phone: "0617485213",
          time: "ช่วง 07.00-15.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      seoTitle: "Baan Pool Villa Pattaya | Private Pool Villas",
      seoDescription: "Book private pool villas in Pattaya.",
      seoOgImageUrl: "/images/seo-cover.jpg",
      seoOgImageAlt: "Pool villa with private swimming pool",
      seoBusinessName: "Baan Pool Villa Pattaya",
      seoSameAsUrls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
    });
  });

  it("serializes bank and contact settings into the admin form data", () => {
    const formData = buildSettingsFormData({
      siteName: "Pool Villas Pattaya",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      heroImageAlt: "Hero",
      logoFile: null,
      heroFile: null,
      bankAccountName: "คุณ อาภัสรา จินดาวา",
      bankName: "ธนาคารกสิกรไทย",
      bankAccountNumber: "398-289-7482",
      phoneContacts: [
        {
          name: "คุณเกม",
          phone: "0617485213",
          time: "ช่วง 07.00-15.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      seoTitle: "Baan Pool Villa Pattaya | Private Pool Villas",
      seoDescription: "Book private pool villas in Pattaya.",
      seoOgImageUrl: "/images/seo-cover.jpg",
      seoOgImageAlt: "Pool villa with private swimming pool",
      seoBusinessName: "Baan Pool Villa Pattaya",
      seoSameAsUrls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
    });

    expect(formData.get("bankAccountName")).toBe("คุณ อาภัสรา จินดาวา");
    expect(formData.get("bankName")).toBe("ธนาคารกสิกรไทย");
    expect(formData.get("bankAccountNumber")).toBe("398-289-7482");
    expect(formData.get("messengerUrl")).toBe(
      "https://www.facebook.com/baanpoolvillas",
    );
    expect(formData.get("lineId")).toBe("@baanpoolvilla");
    expect(formData.get("lineUrl")).toBe(
      "https://line.me/R/ti/p/@baanpoolvilla",
    );
    expect(formData.get("seoTitle")).toBe(
      "Baan Pool Villa Pattaya | Private Pool Villas",
    );
    expect(formData.get("seoDescription")).toBe(
      "Book private pool villas in Pattaya.",
    );
    expect(formData.get("seoOgImageUrl")).toBe("/images/seo-cover.jpg");
    expect(formData.get("seoOgImageAlt")).toBe(
      "Pool villa with private swimming pool",
    );
    expect(formData.get("seoBusinessName")).toBe("Baan Pool Villa Pattaya");
    expect(JSON.parse(String(formData.get("seoSameAsUrls")))).toEqual([
      "https://www.facebook.com/baanpoolvillas",
      "https://line.me/R/ti/p/@baanpoolvilla",
    ]);
    expect(JSON.parse(String(formData.get("phoneContacts")))).toEqual([
      {
        name: "คุณเกม",
        phone: "0617485213",
        time: "ช่วง 07.00-15.00",
      },
    ]);
  });

  it("does not include TikTok fields in form data produced for the settings save endpoint", () => {
    const formData = buildSettingsFormData({
      siteName: "Pool Villas Pattaya",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      heroImageAlt: "Hero",
      logoFile: null,
      heroFile: null,
      bankAccountName: "นายใจดี",
      bankName: "Kasikorn",
      bankAccountNumber: "398-289-7482",
      phoneContacts: [
        {
          name: "นายใจดี",
          phone: "0617485213",
          time: "08.00-16.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
      seoTitle: "Baan Pool Villa Pattaya | Private Pool Villas",
      seoDescription: "Book private pool villas in Pattaya.",
      seoOgImageUrl: "/images/seo-cover.jpg",
      seoOgImageAlt: "Pool villa with private swimming pool",
      seoBusinessName: "Baan Pool Villa Pattaya",
      seoSameAsUrls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
    });

    expect(formData.has("tiktokAccountUrl")).toBe(false);
    expect(formData.has("tiktokVideoUrls")).toBe(false);
  });

  it("does not redirect message-only Supabase or storage errors", () => {
    const payload = { error: "Storage upload failed" };

    expect(shouldRedirectToLogin(403, payload)).toBe(false);
    expect(extractErrors(payload, "Unable to save site settings.")).toEqual([
      "Storage upload failed",
    ]);
  });

  it("redirects 401 responses to login", () => {
    expect(shouldRedirectToLogin(401, { error: "Unauthorized" })).toBe(true);
  });

  it("redirects known admin access failures to login", () => {
    expect(
      shouldRedirectToLogin(403, {
        error: "Signed-in user is not listed as an active home config admin.",
      }),
    ).toBe(true);
    expect(
      shouldRedirectToLogin(403, {
        error: "Unable to verify admin access: permission denied",
      }),
    ).toBe(true);
  });
});
