import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/site-settings/supabase";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "../defaults";
import { getSiteContactSettings } from "../server";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/site-settings/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function mockQuery(result: Error | { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(
    result instanceof Error
      ? () => Promise.reject(result)
      : () => Promise.resolve(result),
  );
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  createHomeConfigClientMock.mockReturnValue({ from } as never);
  return { eq, from, maybeSingle, select };
}

describe("getSiteContactSettings", () => {
  beforeEach(() => {
    createHomeConfigClientMock.mockClear();
  });

  it("loads the singleton through the dedicated cache", async () => {
    const query = mockQuery({
      data: {
        singleton_id: true,
        bank_account_name: "Account Name",
        bank_name: "Bank Name",
        bank_account_number: "123-4-56789-0",
        phone_contacts: [
          { name: "Game", phone: "0617485213", time: "07.00-15.00" },
        ],
        messenger_url: "https://www.facebook.com/baanpoolvillas",
        line_id: "@baanpoolvilla",
        line_url: "https://line.me/R/ti/p/@baanpoolvilla",
      },
      error: null,
    });

    await expect(getSiteContactSettings()).resolves.toMatchObject({
      degraded: false,
      settings: { bank: { accountName: "Account Name" } },
      source: "config",
    });
    expect(query.from).toHaveBeenCalledWith("site_contact_settings");
    expect(query.eq).toHaveBeenCalledWith("singleton_id", true);
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`${CACHE_TAGS.siteContactSettings}:v1`],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.siteContactSettings,
        tags: [CACHE_TAGS.siteContactSettings],
      },
    );
    expect(cache).toHaveBeenCalledWith(expect.any(Function));
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "table unavailable" } },
    new Error("query threw"),
  ])("returns a cloned fallback when the strict read is unavailable", async (result) => {
    mockQuery(result);

    const loaded = await getSiteContactSettings();

    expect(loaded).toEqual({
      degraded: true,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "fallback",
    });
    expect(loaded.settings).not.toBe(DEFAULT_SITE_CONTACT_SETTINGS);
    expect(loaded.settings.contact.phoneContacts).not.toBe(
      DEFAULT_SITE_CONTACT_SETTINGS.contact.phoneContacts,
    );
  });
});
