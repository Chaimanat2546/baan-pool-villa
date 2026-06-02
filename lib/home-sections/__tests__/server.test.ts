import { describe, expect, it, vi } from "vitest";

import type { VillaListing } from "../../villas/types";
import { getResolvedHomeSections } from "../server";
import { createHomeConfigClient } from "../supabase";

vi.mock("server-only", () => ({}));

vi.mock("../supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

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

  it("returns fallback sections when config rows are unavailable", async () => {
    mockHomeSectionsQuery({
      data: [],
      error: null,
    });

    const result = await getResolvedHomeSections([villa]);

    expect(result.source).toBe("fallback");
    expect(result.sections[0]?.villas).toEqual([villa]);
  });
});
