import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateSiteWebStylesCache } from "@/lib/cache-revalidation";
import {
  getAdminWebStyle,
  saveAdminWebStyle,
} from "../admin-route";
import { DEFAULT_GALLERY_CATEGORY_ORDER } from "../gallery-categories";

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

describe("site web styles admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one resolved Gallery style", async () => {
    const query = selectQuery({
      data: {
        options: { backgroundColor: "#ffffff" },
        style_type: "gallery",
        style_variant: "categorized-grid",
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    const response = await getAdminWebStyle("gallery", { from } as never);

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("site_web_styles");
    expect(query.eq).toHaveBeenCalledWith("style_type", "gallery");
    await expect(response.json()).resolves.toEqual({
      settings: {
        backgroundColor: "#ffffff",
        categoryOrder: DEFAULT_GALLERY_CATEGORY_ORDER,
        imageSource: "standard",
        showCover: true,
        variant: "categorized-grid",
      },
    });
  });

  it("saves one canonical Gallery row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        options: { textColor: "#111111" },
        style_type: "gallery",
        style_variant: "categorized-grid",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });

    const response = await saveAdminWebStyle(
      "gallery",
      new Request("https://example.com/api/admin/site-web-styles/gallery", {
        body: JSON.stringify({
          backgroundColor: "",
          textColor: "#111111",
          variant: "categorized-grid",
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { from } as never,
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({
      options: { textColor: "#111111" },
      style_type: "gallery",
      style_variant: "categorized-grid",
    });
    await expect(response.json()).resolves.toEqual({
      settings: {
        categoryOrder: DEFAULT_GALLERY_CATEGORY_ORDER,
        imageSource: "standard",
        showCover: true,
        textColor: "#111111",
        variant: "categorized-grid",
      },
      verified: true,
      warnings: [],
    });
    expect(revalidateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid fields before querying Supabase", async () => {
    const from = vi.fn();

    const response = await saveAdminWebStyle(
      "gallery",
      new Request("https://example.com/api/admin/site-web-styles/gallery", {
        body: JSON.stringify({ extra: true, variant: "lightbox" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { from } as never,
    );

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a warning when cache invalidation fails after saving", async () => {
    revalidateMock.mockRejectedValueOnce(new Error("cache unavailable"));
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { options: {}, style_type: "header", style_variant: "right-booking" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });

    const response = await saveAdminWebStyle(
      "header",
      new Request("https://example.com/api/admin/site-web-styles/header", {
        body: JSON.stringify({ variant: "right-booking" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { from } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      warnings: ["Web style was saved but cache refresh failed."],
    });
  });
});
