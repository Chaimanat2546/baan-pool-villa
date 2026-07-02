import { describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type { VillaListing } from "../../villas/types";
import { getActiveHomeSectionHouseIds, getResolvedHomeSections } from "../server";
import { createHomeConfigClient } from "../supabase";
import { unstable_cache } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("../supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);
const unstableCacheMock = vi.mocked(unstable_cache);

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/901.jpg",
  distanceToSea: "500m",
  id: "901",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "จอมเทียน",
};

function mockHomeSectionsQuery(result: { data: unknown; error: unknown }) {
  const orderItems = vi.fn().mockResolvedValue(result);
  const orderSections = vi.fn().mockReturnValue({ order: orderItems });
  const eq = vi.fn().mockReturnValue({ order: orderSections });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { eq, from, orderItems, orderSections, select };
}

describe("getResolvedHomeSections", () => {
  it("wraps the Supabase home section read in a tagged Next cache", async () => {
    mockHomeSectionsQuery({
      data: [],
      error: null,
    });

    await getResolvedHomeSections([villa]);

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.homeSections],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.homeSections,
        tags: [CACHE_TAGS.homeSections],
      },
    );
  });

  it("returns configured sections when active rows resolve to villas", async () => {
    mockHomeSectionsQuery({
      data: [
        {
          cta_enabled: true,
          cta_href: "/search",
          cta_label: "ดูเพิ่มเติม",
          description: "บ้านพักแนะนำ",
          display_order: 0,
          fallback_mode: "none",
          home_section_items: [
            {
              house_id: "901",
              is_active: true,
              position: 0,
            },
          ],
          is_active: true,
          limit_count: 6,
          mode: "manual",
          slice_offset: 0,
          slug: "featured",
          title: "บ้านพักแนะนำ",
        },
      ],
      error: null,
    });

    await expect(getResolvedHomeSections([villa])).resolves.toEqual({
      degraded: false,
      sections: [
        {
          cta: {
            href: "/search",
            label: "ดูเพิ่มเติม",
          },
          description: "บ้านพักแนะนำ",
          slug: "featured",
          title: "บ้านพักแนะนำ",
          villas: [villa],
        },
      ],
      source: "config",
    });
  });

  it("returns active configured house ids for homepage listing fetches", async () => {
    mockHomeSectionsQuery({
      data: [
        {
          cta_enabled: false,
          cta_href: null,
          cta_label: null,
          description: "",
          display_order: 0,
          fallback_mode: "none",
          home_section_items: [
            { house_id: "1328", is_active: true, position: 0 },
            { house_id: "55", is_active: true, position: 1 },
            { house_id: "55", is_active: true, position: 2 },
            { house_id: "999", is_active: false, position: 3 },
          ],
          is_active: true,
          limit_count: 6,
          mode: "manual",
          slice_offset: 0,
          slug: "featured",
          title: "",
        },
        {
          cta_enabled: false,
          cta_href: null,
          cta_label: null,
          description: "",
          display_order: 1,
          fallback_mode: "none",
          home_section_items: [
            { house_id: "777", is_active: true, position: 0 },
          ],
          is_active: false,
          limit_count: 6,
          mode: "manual",
          slice_offset: 0,
          slug: "hidden",
          title: "",
        },
      ],
      error: null,
    });

    await expect(getActiveHomeSectionHouseIds()).resolves.toEqual(["1328", "55"]);
  });

  it("returns intentional fallback sections when no config rows resolve", async () => {
    mockHomeSectionsQuery({
      data: [],
      error: null,
    });

    const result = await getResolvedHomeSections([villa]);

    expect(result.source).toBe("fallback");
    expect(result.degraded).toBe(false);
    expect(result.fallbackReason).toBe("empty_config");
    expect(result.sections[0]?.villas).toEqual([villa]);
  });

  it("marks fallback sections as degraded when config rows cannot be loaded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockHomeSectionsQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    const result = await getResolvedHomeSections([villa]);

    expect(result.source).toBe("fallback");
    expect(result.degraded).toBe(true);
    expect(result.fallbackReason).toBe("config_unavailable");
    expect(result.sections[0]?.villas).toEqual([villa]);
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to load home section config",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it("caches an empty Supabase home section result before falling back", async () => {
    vi.resetModules();

    const from = vi.fn(() => {
      return {
        select: vi.fn(() => {
          return {
            eq: vi.fn(() => {
              return {
                order: vi.fn(() => {
                  return {
                    order: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  };
                }),
              };
            }),
          };
        }),
      };
    });
    const isolatedCreateClient = vi.fn(() => ({ from }));
    const isolatedUnstableCache = vi.fn((fn: () => Promise<unknown>) => {
      let cachedValue: unknown;
      let hasCachedValue = false;

      return async () => {
        if (hasCachedValue) {
          return cachedValue;
        }

        cachedValue = await fn();
        hasCachedValue = true;
        return cachedValue;
      };
    });
    const resolveHomeSectionsMock = vi.fn(() => []);

    vi.doMock("next/cache", () => ({
      unstable_cache: isolatedUnstableCache,
    }));
    vi.doMock("../supabase", () => ({
      createHomeConfigClient: isolatedCreateClient,
    }));
    vi.doMock("../resolve", async () => {
      const actual = await vi.importActual<typeof import("../resolve")>(
        "../resolve",
      );

      return {
        ...actual,
        resolveHomeSections: resolveHomeSectionsMock,
      };
    });

    const { getResolvedHomeSections: getIsolatedResolvedHomeSections } =
      await import("../server");

    await getIsolatedResolvedHomeSections([villa]);
    await getIsolatedResolvedHomeSections([villa]);

    expect(resolveHomeSectionsMock).toHaveBeenCalledWith([], [villa]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
