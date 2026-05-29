import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "../defaults";
import { getSiteSettings } from "../server";
import { createHomeConfigClient } from "../supabase";

vi.mock("server-only", () => ({}));

vi.mock("../supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function mockSiteSettingsQuery(result: {
  data: unknown;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { eq, from, maybeSingle, select };
}

function mockSiteSettingsQueryQueue(
  results: { data: unknown; error: unknown }[],
) {
  const queries = results.map((result) => {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    return { eq, maybeSingle, select };
  });
  const from = vi.fn().mockImplementation(() => {
    const query = queries.shift();

    if (!query) {
      throw new Error("Unexpected site_settings query");
    }

    return query;
  });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { from };
}

describe("getSiteSettings", () => {
  it("returns normalized settings from the config table", async () => {
    const query = mockSiteSettingsQuery({
      data: {
        id: SITE_SETTINGS_ID,
        site_name: " Baan Pool Villa ",
        primary_color: "#123456",
        accent_color: "#abcdef",
        logo_image_path: "logo/2026/05/logo.webp",
        logo_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
        hero_image_path: "hero/2026/05/hero.webp",
        hero_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
        hero_image_alt: "Pool villas",
        bank_account_name: " คุณ อาภัสรา จินดาวา ",
        bank_name: " ธนาคารกสิกรไทย ",
        bank_account_number: " 398-289-7482 ",
        phone_contacts: [
          {
            name: " คุณเกม ",
            phone: " 0617485213 ",
            time: " ช่วง 07.00-15.00 ",
          },
        ],
        messenger_url: " https://www.facebook.com/baanpoolvillas ",
        line_id: " @baanpoolvilla ",
        line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
      },
      error: null,
    });

    await expect(getSiteSettings()).resolves.toEqual({
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#123456",
        accentColor: "#abcdef",
        logoImage: {
          path: "logo/2026/05/logo.webp",
          url: "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          alt: "Baan Pool Villa logo",
        },
        heroImage: {
          path: "hero/2026/05/hero.webp",
          url: "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          alt: "Pool villas",
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
      },
      source: "config",
    });
    expect(query.from).toHaveBeenCalledWith("site_settings");
    expect(query.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
  });

  it("returns fallback settings when the config row is unavailable", async () => {
    mockSiteSettingsQuery({ data: null, error: null });

    await expect(getSiteSettings()).resolves.toEqual({
      settings: DEFAULT_SITE_SETTINGS,
      source: "fallback",
    });
  });

  it("keeps legacy settings when contact columns are not available yet", async () => {
    mockSiteSettingsQueryQueue([
      {
        data: null,
        error: { message: "column site_settings.bank_account_name does not exist" },
      },
      {
        data: {
          id: SITE_SETTINGS_ID,
          site_name: " Baan Pool Villa ",
          primary_color: "#123456",
          accent_color: "#abcdef",
          logo_image_path: "logo/2026/05/logo.webp",
          logo_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          hero_image_path: "hero/2026/05/hero.webp",
          hero_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          hero_image_alt: "Pool villas",
        },
        error: null,
      },
    ]);

    await expect(getSiteSettings()).resolves.toMatchObject({
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#123456",
        accentColor: "#abcdef",
        bank: DEFAULT_SITE_SETTINGS.bank,
        contact: DEFAULT_SITE_SETTINGS.contact,
      },
      source: "config",
    });
  });
});
