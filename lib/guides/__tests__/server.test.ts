import { describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type { VillaListing } from "../../villas/types";
import {
  getGuideBySlug,
  getPublishedGuides,
  resolveGuideRecommendedVillas,
} from "../server";
import { createHomeConfigClient } from "../../home-sections/supabase";
import { unstable_cache } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("../../home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);
const unstableCacheMock = vi.mocked(unstable_cache);

const baseGuideRow = {
  id: "guide-1",
  slug: "family-pool-villa",
  title: " Family pool villa ",
  excerpt: " Pick villas for families. ",
  cover_image_path: "guides/2026/06/family.webp",
  cover_image_url: "https://cdn.example.com/family.webp",
  cover_image_alt: " Family pool villa ",
  content_blocks: [
    {
      id: "intro",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: "Intro", styles: {} }],
      children: [],
    },
  ],
  tags: [" family ", "pattaya"],
  recommended_house_ids: ["DV-66", "102"],
  status: "published",
  is_pinned: true,
  published_at: "2026-06-03T03:00:00.000Z",
  created_at: "2026-06-01T03:00:00.000Z",
  updated_at: "2026-06-02T03:00:00.000Z",
};

const villas: VillaListing[] = [
  {
    amenities: [],
    bathrooms: 4,
    bedrooms: 5,
    coverImage: "https://example.com/66.jpg",
    distanceToSea: "500m",
    id: "66",
    people: 12,
    poolType: "private",
    price: 12000,
    zone: "jomtien",
    zoneLabel: "จอมเทียน",
  },
  {
    amenities: [],
    bathrooms: 5,
    bedrooms: 6,
    coverImage: "https://example.com/102.jpg",
    distanceToSea: "900m",
    id: "102",
    people: 15,
    poolType: "private",
    price: 16000,
    zone: "pattaya",
    zoneLabel: "พัทยา",
  },
];

function mockGuideListQuery(result: { data: unknown; error: unknown }) {
  const orderPublishedAt = vi.fn().mockResolvedValue(result);
  const orderPinned = vi.fn().mockReturnValue({ order: orderPublishedAt });
  const eq = vi.fn().mockReturnValue({ order: orderPinned });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { eq, from, orderPinned, orderPublishedAt, select };
}

function mockGuideDetailQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const slugEq = vi.fn().mockReturnValue({ maybeSingle });
  const statusEq = vi.fn().mockReturnValue({ eq: slugEq });
  const select = vi.fn().mockReturnValue({ eq: statusEq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { from, maybeSingle, select, slugEq, statusEq };
}

describe("getPublishedGuides", () => {
  it("wraps the Supabase guide list read in a tagged Next cache", async () => {
    mockGuideListQuery({ data: [], error: null });

    await getPublishedGuides();

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.guides],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.guides,
        tags: [CACHE_TAGS.guides],
      },
    );
  });

  it("returns normalized published guides ordered by pinned rows first", async () => {
    const query = mockGuideListQuery({
      data: [baseGuideRow],
      error: null,
    });

    await expect(getPublishedGuides()).resolves.toEqual([
      {
        id: "guide-1",
        title: "Family pool villa",
        slug: "family-pool-villa",
        excerpt: "Pick villas for families.",
        coverImage: {
          alt: "Family pool villa",
          path: "guides/2026/06/family.webp",
          url: "https://cdn.example.com/family.webp",
        },
        contentBlocks: baseGuideRow.content_blocks,
        tags: ["family", "pattaya"],
        recommendedHouseIds: ["66", "102"],
        status: "published",
        isPinned: true,
        publishedAt: "2026-06-03T03:00:00.000Z",
        createdAt: "2026-06-01T03:00:00.000Z",
        updatedAt: "2026-06-02T03:00:00.000Z",
      },
    ]);
    expect(query.from).toHaveBeenCalledWith("guide_posts");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.orderPinned).toHaveBeenCalledWith("is_pinned", {
      ascending: false,
    });
  });

  it("throws when guide config is unavailable", async () => {
    mockGuideListQuery({ data: null, error: { message: "RLS denied" } });

    await expect(getPublishedGuides()).rejects.toThrow(
      "Guide posts config is unavailable",
    );
  });
});

describe("getGuideBySlug", () => {
  it("loads one published guide by slug with a detail cache tag", async () => {
    const query = mockGuideDetailQuery({ data: baseGuideRow, error: null });

    await expect(getGuideBySlug("family-pool-villa")).resolves.toMatchObject({
      id: "guide-1",
      slug: "family-pool-villa",
      status: "published",
    });
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.guide("family-pool-villa")],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.guides,
        tags: [CACHE_TAGS.guides, CACHE_TAGS.guide("family-pool-villa")],
      },
    );
    expect(query.statusEq).toHaveBeenCalledWith("status", "published");
    expect(query.slugEq).toHaveBeenCalledWith("slug", "family-pool-villa");
  });

  it("decodes browser-encoded Thai slugs before querying Supabase", async () => {
    const query = mockGuideDetailQuery({
      data: {
        ...baseGuideRow,
        slug: "5-วิธีเลือกพูลวิลล่าพัทยา",
      },
      error: null,
    });

    await getGuideBySlug(
      "5-%E0%B8%A7%E0%B8%B4%E0%B8%98%E0%B8%B5%E0%B9%80%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%9E%E0%B8%B9%E0%B8%A5%E0%B8%A7%E0%B8%B4%E0%B8%A5%E0%B8%A5%E0%B9%88%E0%B8%B2%E0%B8%9E%E0%B8%B1%E0%B8%97%E0%B8%A2%E0%B8%B2",
    );

    expect(query.slugEq).toHaveBeenCalledWith(
      "slug",
      "5-วิธีเลือกพูลวิลล่าพัทยา",
    );
  });

  it("returns null when a slug is not published", async () => {
    mockGuideDetailQuery({ data: null, error: null });

    await expect(getGuideBySlug("missing")).resolves.toBeNull();
  });

  it("throws when the guide detail config is unavailable", async () => {
    mockGuideDetailQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(getGuideBySlug("family-pool-villa")).rejects.toThrow(
      "Guide posts config is unavailable",
    );
  });
});

describe("resolveGuideRecommendedVillas", () => {
  it("keeps the CMS selected villa order and skips missing IDs", () => {
    expect(resolveGuideRecommendedVillas(["102", "missing", "66"], villas)).toEqual([
      villas[1],
      villas[0],
    ]);
  });
});
