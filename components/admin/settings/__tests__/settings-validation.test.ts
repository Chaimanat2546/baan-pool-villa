import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { mapContactSettingsResponse, mapSeoSettingsResponse } from "../settings-helpers";
import {
  validateBrandSettingsDraft,
  validateContactSettingsDraft,
  validateHeroSettingsDraft,
  validateSeoSettingsDraft,
  validateThemeSettingsDraft,
} from "../settings-validation";

describe("section settings validation", () => {
  it("validates each section without unrelated settings", () => {
    expect(validateBrandSettingsDraft({ siteName: " ", logoBackground: "white", logoFile: null, faviconFile: null, logoImage: DEFAULT_SITE_SETTINGS.logoImage, faviconImage: DEFAULT_SITE_SETTINGS.faviconImage })).toHaveLength(1);
    expect(validateThemeSettingsDraft({ ...DEFAULT_SITE_SETTINGS, primaryColor: "bad" })).toHaveLength(1);
    expect(validateHeroSettingsDraft({ heroFile: null, heroImage: DEFAULT_SITE_SETTINGS.heroImage, heroImageAlt: "x".repeat(161) })).toHaveLength(1);

    const seo = mapSeoSettingsResponse({ settings: { seo: DEFAULT_SITE_SETTINGS.seo, pageSeo: DEFAULT_SITE_SETTINGS.pageSeo } });
    expect(validateSeoSettingsDraft({ ...seo, seoTitle: "x".repeat(81) })).toHaveLength(1);

    const contact = mapContactSettingsResponse({ settings: { bank: DEFAULT_SITE_SETTINGS.bank, contact: DEFAULT_SITE_SETTINGS.contact } });
    expect(validateContactSettingsDraft({ ...contact, bankName: "" })).toHaveLength(1);
  });
});
