import { describe, expect, it, vi } from "vitest";

import { revalidateSiteWebStylesCache } from "@/lib/cache-revalidation";
import {
  getAdminSiteHeaderSettings,
  saveAdminSiteHeaderSettings,
} from "../admin-route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteWebStylesCache: vi.fn(),
}));

const revalidateMock = vi.mocked(revalidateSiteWebStylesCache);

function selectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { eq, select };
}

describe("site header settings admin route", () => {
  it("returns the isolated saved variant", async () => {
    const query = selectQuery({
      data: { options: {}, style_type: "header", style_variant: "right-booking" },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    const response = await getAdminSiteHeaderSettings({ from } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: { desktopHeaderVariant: "right-booking" },
    });
    expect(from).toHaveBeenCalledWith("site_web_styles");
  });

  it("persists only the supported header variant", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { options: {}, style_type: "header", style_variant: "right-booking" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });

    const response = await saveAdminSiteHeaderSettings(
      new Request("https://example.com/api/admin/site-header-settings", {
        body: JSON.stringify({ desktopHeaderVariant: "right-booking" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { from } as never,
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({
      options: {},
      style_type: "header",
      style_variant: "right-booking",
    });
    await expect(response.json()).resolves.toEqual({
      settings: { desktopHeaderVariant: "right-booking" },
      verified: true,
      warnings: [],
    });
    expect(revalidateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported values before accessing Supabase", async () => {
    const from = vi.fn();

    const response = await saveAdminSiteHeaderSettings(
      new Request("https://example.com/api/admin/site-header-settings", {
        body: JSON.stringify({ desktopHeaderVariant: "legacy" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { from } as never,
    );

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
