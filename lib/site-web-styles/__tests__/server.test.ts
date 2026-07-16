import { describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { DEFAULT_SITE_WEB_STYLES } from "../defaults";
import { getSiteWebStyles } from "../server";

const { cacheRegistrations } = vi.hoisted(() => ({
  cacheRegistrations: [] as Array<{
    keyParts: string[];
    options: { revalidate: number; tags: string[] };
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (
    fn: unknown,
    keyParts: string[],
    options: { revalidate: number; tags: string[] },
  ) => {
    cacheRegistrations.push({ keyParts, options });
    return fn;
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function mockStylesQuery(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ select });
  createHomeConfigClientMock.mockReturnValue({ from } as ReturnType<typeof createHomeConfigClient>);
  return { from, select };
}

describe("getSiteWebStyles", () => {
  it("reads and caches all three style rows", async () => {
    const query = mockStylesQuery({
      data: [
        { options: {}, style_type: "header", style_variant: "right-booking" },
        { options: {}, style_type: "gallery", style_variant: "lightbox" },
        { options: {}, style_type: "house_card", style_variant: "gallery" },
      ],
      error: null,
    });

    await expect(getSiteWebStyles()).resolves.toEqual({
      gallery: { variant: "lightbox" },
      header: { variant: "right-booking" },
      houseCard: { variant: "gallery" },
    });
    expect(query.from).toHaveBeenCalledWith("site_web_styles");
    expect(query.select).toHaveBeenCalledWith("style_type,style_variant,options");
    expect(cacheRegistrations).toContainEqual({
      keyParts: [`${CACHE_TAGS.siteWebStyles}:v1`],
      options: {
        revalidate: CACHE_REVALIDATE_SECONDS.siteWebStyles,
        tags: [CACHE_TAGS.siteWebStyles],
      },
    });
  });

  it("returns a clone of defaults when Supabase is unavailable", async () => {
    mockStylesQuery({ data: null, error: { message: "table missing" } });

    const first = await getSiteWebStyles();
    first.gallery.variant = "categorized-grid";

    await expect(getSiteWebStyles()).resolves.toEqual(DEFAULT_SITE_WEB_STYLES);
  });
});
