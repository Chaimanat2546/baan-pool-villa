import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveAdvertisements,
  getAdvertisementImageSource,
} from "../server";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/home-sections/cache", () => ({
  createHomeConfigCachedLoader: (fn: unknown) => fn,
}));
vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));
const id = "10000000-0000-4000-8000-000000000001";
const imageId = "20000000-0000-4000-8000-000000000001";
const row = {
  id,
  title: " เที่ยวทะเล ",
  zone: "all",
  is_active: true,
  sort_order: 0,
  site_advertisement_images: [
    { id: imageId, storage_path: `${id}/${imageId}.webp`, display_order: 0 },
  ],
};
const result = { data: [row], error: null };
const query = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
};
const from = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  result.data = [row];
  result.error = null;
  for (const fn of [query.select, query.eq, query.in, query.order])
    fn.mockReturnValue(query);
  query.limit.mockImplementation(() => Promise.resolve(result));
  query.maybeSingle.mockResolvedValue({
    data: {
      ...row.site_advertisement_images[0],
      site_advertisements: { is_active: true },
    },
    error: null,
  });
  from.mockReturnValue(query);
  vi.mocked(createHomeConfigClient).mockReturnValue({
    from,
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://tenant.supabase.co/storage/v1/object/public/advertisement-assets/${path}`,
          },
        }),
      }),
    },
  } as never);
});
describe("site-owned advertisements", () => {
  it("shows only the first two ordered images from an older oversized advertisement", async () => {
    const ids = [3, 1, 2].map(n => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    result.data = [{ ...row, site_advertisement_images: ids.map((imageId, index) => ({ id: imageId, storage_path: `${id}/${imageId}.webp`, display_order: [2, 0, 1][index] })) }];
    expect((await getActiveAdvertisements())[0].imageUrls).toEqual([
      `/api/advertisements/images/${ids[1]}`,
      `/api/advertisements/images/${ids[2]}`,
    ]);
  });
  it("reads this site's CMS and exposes only local image routes", async () => {
    expect(await getActiveAdvertisements(" Pattaya ")).toEqual([
      {
        id,
        title: "เที่ยวทะเล",
        imageUrl: `/api/advertisements/images/${imageId}`,
        imageUrls: [`/api/advertisements/images/${imageId}`],
      },
    ]);
    expect(from).toHaveBeenCalledWith("site_advertisements");
    expect(query.in).toHaveBeenCalledWith("zone", ["pattaya", "all"]);
    expect(query.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });
  it("uses only global advertisements when villa zone is absent", async () => {
    await getActiveAdvertisements();
    expect(query.eq).toHaveBeenCalledWith("zone", "all");
  });
  it("skips malformed nested rows and paths belonging to another ad", async () => {
    result.data = [
      {
        ...row,
        site_advertisement_images: [
          null,
          {
            ...row.site_advertisement_images[0],
            storage_path: `other/${imageId}.webp`,
          },
        ],
      },
    ] as never;
    expect(await getActiveAdvertisements("pattaya")).toEqual([]);
  });
  it("resolves image sources only from this website's bucket", async () => {
    expect(await getAdvertisementImageSource(imageId)).toBe(
      `https://tenant.supabase.co/storage/v1/object/public/advertisement-assets/${id}/${imageId}.webp`,
    );
  });
  it("rejects invalid image ids before accessing Supabase", async () => {
    expect(await getAdvertisementImageSource("../secret")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("does not serve inactive advertisements", async () => {
    query.maybeSingle.mockResolvedValue({
      data: {
        ...row.site_advertisement_images[0],
        site_advertisements: { is_active: false },
      },
      error: null,
    });
    expect(await getAdvertisementImageSource(imageId)).toBeNull();
  });
});
