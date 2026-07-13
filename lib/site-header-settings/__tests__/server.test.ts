import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_HEADER_SETTINGS } from "../defaults";
import { getSiteHeaderSettings } from "../server";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function mockHeaderSettingsQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  createHomeConfigClientMock.mockReturnValue({ from } as ReturnType<typeof createHomeConfigClient>);
  return { eq, from, select };
}

describe("getSiteHeaderSettings", () => {
  it("reads the isolated header singleton", async () => {
    const query = mockHeaderSettingsQuery({
      data: { desktop_header_variant: "right-booking" },
      error: null,
    });

    await expect(getSiteHeaderSettings()).resolves.toEqual({
      desktopHeaderVariant: "right-booking",
    });
    expect(query.from).toHaveBeenCalledWith("site_header_settings");
    expect(query.select).toHaveBeenCalledWith("desktop_header_variant");
    expect(query.eq).toHaveBeenCalledWith("singleton_id", true);
  });

  it("uses the safe default when the new table is unavailable", async () => {
    mockHeaderSettingsQuery({ data: null, error: { message: "table missing" } });

    await expect(getSiteHeaderSettings()).resolves.toEqual(
      DEFAULT_SITE_HEADER_SETTINGS,
    );
  });
});
