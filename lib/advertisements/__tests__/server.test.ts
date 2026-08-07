import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  buildAdvertisementImageUrl,
  normalizeAdvertisementId,
  normalizeAdvertisementImageName,
} from "../image-url";
import { getActiveAdvertisements, toPublicAdvertisement } from "../server";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);
const unstableCacheMock = vi.mocked(unstable_cache);

beforeEach(() => {
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  createClientMock.mockReset();
});

function mockAdvertisementQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const inFilter = vi.fn().mockReturnValue({ order });
  const eq = vi.fn().mockReturnValue({ in: inFilter, order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createClientMock.mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createClient>);

  return { eq, from, inFilter, order, select };
}

describe("advertisement image URLs", () => {
  it("builds worker image URLs from safe image names", () => {
    expect(
      buildAdvertisementImageUrl({
        advertisementId: "dc403c27-9a30-413b-97dc-79c299849e60",
        imageName: "20260702103418_6762b81ddc.webp",
      }),
    ).toBe(
      "https://webook-media.poolvilla.workers.dev/advertisements/dc403c27-9a30-413b-97dc-79c299849e60/20260702103418_6762b81ddc.webp",
    );
    expect(
      buildAdvertisementImageUrl(
        {
          advertisementId: "ad-1",
          imageName: "activity.webp",
        },
        "https://assets.example.com/ads/:id/:imageName",
      ),
    ).toBe("https://assets.example.com/ads/ad-1/activity.webp");
    expect(normalizeAdvertisementId("../ad-1")).toBeNull();
    expect(normalizeAdvertisementImageName("../secret.webp")).toBeNull();
    expect(normalizeAdvertisementImageName("not-image.txt")).toBeNull();
  });
});

describe("getActiveAdvertisements", () => {
  it("wraps the public advertisement read in a tagged cache", async () => {
    const query = mockAdvertisementQuery({ data: [], error: null });

    await getActiveAdvertisements();

    expect(query.inFilter).not.toHaveBeenCalled();
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.advertisements],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.advertisements,
        tags: [CACHE_TAGS.advertisements],
      },
    );
  });

  it("returns active advertisements with ordered images", async () => {
    const query = mockAdvertisementQuery({
      data: [
        {
          id: "ad-1",
          title: " Activity ",
          is_active: true,
          advertisement_images: [
            {
              image_name: "second.webp",
              image_order: 2,
              created_at: "2026-07-02T03:34:19.000Z",
            },
            {
              image_name: "first.webp",
              image_order: 1,
              created_at: "2026-07-02T03:34:18.000Z",
            },
          ],
        },
      ],
      error: null,
    });

    await expect(getActiveAdvertisements(" Pattaya ")).resolves.toEqual([
      {
        id: "ad-1",
        imageUrl:
          "https://webook-media.poolvilla.workers.dev/advertisements/ad-1/first.webp",
        imageUrls: [
          "https://webook-media.poolvilla.workers.dev/advertisements/ad-1/first.webp",
          "https://webook-media.poolvilla.workers.dev/advertisements/ad-1/second.webp",
        ],
        title: "Activity",
      },
    ]);
    expect(query.from).toHaveBeenCalledWith("advertisements");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.inFilter).toHaveBeenCalledWith("zone", ["pattaya", "all"]);
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("skips inactive rows and rows without a usable image", () => {
    expect(
      toPublicAdvertisement({
        id: "ad-1",
        title: "Activity",
        is_active: false,
        advertisement_images: [{ image_name: "activity.webp" }],
      }),
    ).toBeNull();
    expect(
      toPublicAdvertisement({
        id: "ad-1",
        title: "Activity",
        is_active: true,
        advertisement_images: [{ image_name: "../activity.webp" }],
      }),
    ).toBeNull();
  });

  it("throws when advertisements are unavailable", async () => {
    mockAdvertisementQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(getActiveAdvertisements()).rejects.toThrow(
      "Advertisements are unavailable",
    );
  });
});
