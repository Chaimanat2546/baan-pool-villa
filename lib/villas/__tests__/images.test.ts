import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { unstable_cache } from "next/cache";
import {
  buildProxyImageUrl,
  fetchVillaImages,
  fetchVillaPreviewImages,
  normalizeImageRows,
  normalizeImageUrl,
} from "../images";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/villas/images", async () => import("../images"));

const originalEnv = process.env;
const unstableCacheMock = vi.mocked(unstable_cache);

function setSupabaseEnv() {
  process.env.IMAGE_PROXY_BASE_URL = "https://images.example.com/";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
}

function makeImagesQuery(response: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    then: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.then.mockImplementation(
    (
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) => Promise.resolve(response).then(resolve, reject),
  );

  return query;
}

function mockImagesQuerySequence(responses: unknown[]) {
  const queries = responses.map(makeImagesQuery);
  let queryIndex = 0;
  const supabase = {
    from: vi.fn(() => queries[Math.min(queryIndex++, queries.length - 1)]),
  };

  createClientMock.mockReturnValue(supabase);

  return { query: queries[0], queries, supabase };
}

function mockImagesQuery(response: unknown) {
  return mockImagesQuerySequence([response]);
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  createClientMock.mockReset();
  unstableCacheMock.mockClear();
  process.env = { ...originalEnv };
  setSupabaseEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeImageRows", () => {
  it("normalizes absolute and project-relative Supabase image URLs", () => {
    expect(
      normalizeImageUrl(
        "/storage/v1/object/public/villas/pool.jpg",
        "https://example.supabase.co",
      ),
    ).toBe("https://example.supabase.co/storage/v1/object/public/villas/pool.jpg");
    expect(normalizeImageUrl("https://cdn.example.com/pool.jpg")).toBe(
      "https://cdn.example.com/pool.jpg",
    );
  });

  it("uses raw image URLs before falling back to image_name proxy URLs", () => {
    expect(buildProxyImageUrl("pool image.jpg", "https://images.example.com/")).toBe(
      "https://images.example.com/pool%20image.jpg",
    );

    expect(
      normalizeImageRows([
        {
          id: 7,
          property_id: 42,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: "/storage/v1/object/public/villas/pool.jpg",
          caption: "Pool view",
          image_zone: "pattaya",
        },
      ], "https://rqizfiayvcbozlzuvbok.supabase.co", "https://images.example.com/"),
    ).toEqual([
      {
        id: 7,
        imageUrl:
          "https://rqizfiayvcbozlzuvbok.supabase.co/storage/v1/object/public/villas/pool.jpg",
        imageName: "pool.jpg",
        caption: "Pool view",
        isCover: true,
        zone: "pattaya",
      },
    ]);
  });

  it("falls back to raw image_url when image_name is missing", () => {
    expect(
      normalizeImageRows([
        {
          id: 7,
          property_id: 42,
          cover_select: 1,
          image_name: null,
          image_url: "/storage/v1/object/public/villas/pool.jpg",
          caption: "Pool view",
          image_zone: "pattaya",
        },
      ]),
    ).toEqual([
      {
        id: 7,
        imageUrl:
          "https://rqizfiayvcbozlzuvbok.supabase.co/storage/v1/object/public/villas/pool.jpg",
        imageName: null,
        caption: "Pool view",
        isCover: true,
        zone: "pattaya",
      },
    ]);
  });

  it("filters out rows without image names or image URLs", () => {
    expect(
      normalizeImageRows([
        {
          id: 8,
          property_id: 42,
          cover_select: 0,
          image_name: null,
          image_url: null,
          caption: null,
          image_zone: null,
        },
        {
          id: 9,
          property_id: 42,
          cover_select: 0,
          image_name: null,
          caption: null,
          image_zone: null,
        } as Parameters<typeof normalizeImageRows>[0][number],
      ]),
    ).toEqual([]);
  });
});

describe("fetchVillaImages", () => {
  it("wraps each villa image query in a tagged Next cache", async () => {
    mockImagesQuery({ data: [], error: null });

    await fetchVillaImages("9");

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.villaImage("9")],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.villaImages,
        tags: [CACHE_TAGS.villaImages, CACHE_TAGS.villaImage("9")],
      },
    );
  });

  it("queries villa images by positive decimal id and normalizes returned data", async () => {
    const { query, supabase } = mockImagesQuery({
      data: [
        {
          id: 7,
          property_id: 9,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: "/storage/v1/object/public/villas/pool.jpg",
          caption: "Pool view",
          image_zone: "pattaya",
        },
        {
          id: 8,
          property_id: 9,
          cover_select: 0,
          image_name: "missing.jpg",
          image_url: null,
          caption: null,
          image_zone: null,
        },
      ],
      error: null,
    });

    await expect(fetchVillaImages("9")).resolves.toEqual([
      {
        id: 7,
        imageUrl:
          "https://example.supabase.co/storage/v1/object/public/villas/pool.jpg",
        imageName: "pool.jpg",
        caption: "Pool view",
        isCover: true,
        zone: "pattaya",
      },
      {
        id: 8,
        imageUrl: "https://images.example.com/missing.jpg",
        imageName: "missing.jpg",
        caption: null,
        isCover: false,
        zone: null,
      },
    ]);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(supabase.from).toHaveBeenCalledWith("images");
    expect(query.select).toHaveBeenCalledWith(
      "id, property_id, cover_select, image_name, image_url, caption, image_zone",
    );
    expect(query.eq).toHaveBeenCalledWith("property_id", 9);
    expect(query.order).toHaveBeenNthCalledWith(1, "cover_select", {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("rejects malformed ids before creating a Supabase client", async () => {
    await expect(fetchVillaImages("abc")).rejects.toThrow("Invalid villa id");

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("uses the known Supabase project URL when only the publishable key is configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    mockImagesQuery({ data: [], error: null });

    await expect(fetchVillaImages("9")).resolves.toEqual([]);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://rqizfiayvcbozlzuvbok.supabase.co",
      "publishable-key",
      expect.any(Object),
    );
  });

  it("accepts legacy NEXT_PUBLIC Supabase key env names", async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "next-public-key";
    mockImagesQuery({ data: [], error: null });

    await expect(fetchVillaImages("9")).resolves.toEqual([]);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "next-public-key",
      expect.any(Object),
    );
  });

  it("falls back to legacy image rows when the image_url column is unavailable", async () => {
    const { queries } = mockImagesQuerySequence([
      {
        data: null,
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'image_url' column of 'images' in the schema cache",
        },
      },
      {
        data: [
          {
            id: 7,
            property_id: 9,
            cover_select: 1,
            image_name: "pool.jpg",
            caption: "Pool",
            image_zone: "pool",
          },
        ],
        error: null,
      },
    ]);

    await expect(fetchVillaImages("9")).resolves.toEqual([
      {
        id: 7,
        imageUrl: "https://images.example.com/pool.jpg",
        imageName: "pool.jpg",
        caption: "Pool",
        isCover: true,
        zone: "pool",
      },
    ]);

    expect(queries[0]?.select).toHaveBeenCalledWith(
      "id, property_id, cover_select, image_name, image_url, caption, image_zone",
    );
    expect(queries[1]?.select).toHaveBeenCalledWith(
      "id, property_id, cover_select, image_name, caption, image_zone",
    );
  });
});

describe("fetchVillaPreviewImages", () => {
  it("returns the same prioritized images that the detail gallery displays first", async () => {
    const { query } = mockImagesQuery({
      data: [
        {
          id: 1,
          property_id: 9,
          cover_select: 1,
          image_name: "cover.jpg",
          image_url: null,
          caption: "Cover",
          image_zone: "cover",
        },
        {
          id: 2,
          property_id: 9,
          cover_select: 0,
          image_name: "uncategorized.jpg",
          image_url: null,
          caption: "Uncategorized",
          image_zone: null,
        },
        {
          id: 3,
          property_id: 9,
          cover_select: 0,
          image_name: "inside.jpg",
          image_url: null,
          caption: "Inside",
          image_zone: "inside",
        },
        {
          id: 4,
          property_id: 9,
          cover_select: 0,
          image_name: "outside.jpg",
          image_url: null,
          caption: "Outside",
          image_zone: "outside",
        },
        {
          id: 5,
          property_id: 9,
          cover_select: 0,
          image_name: "review.jpg",
          image_url: null,
          caption: "Review",
          image_zone: "review",
        },
      ],
      error: null,
    });

    await expect(fetchVillaPreviewImages("9")).resolves.toEqual([
      {
        id: 1,
        imageUrl: "https://images.example.com/cover.jpg",
        imageName: "cover.jpg",
        caption: "Cover",
        isCover: true,
        zone: "cover",
      },
      {
        id: 4,
        imageUrl: "https://images.example.com/outside.jpg",
        imageName: "outside.jpg",
        caption: "Outside",
        isCover: false,
        zone: "outside",
      },
      {
        id: 3,
        imageUrl: "https://images.example.com/inside.jpg",
        imageName: "inside.jpg",
        caption: "Inside",
        isCover: false,
        zone: "inside",
      },
      {
        id: 5,
        imageUrl: "https://images.example.com/review.jpg",
        imageName: "review.jpg",
        caption: "Review",
        isCover: false,
        zone: "review",
      },
    ]);

    expect(query.eq).toHaveBeenCalledWith("property_id", 9);
    expect(query.order).toHaveBeenNthCalledWith(1, "cover_select", {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(query.limit).not.toHaveBeenCalled();
  });
});

describe("GET /api/villas/[id]/images", () => {
  it("rate limits repeated image requests before querying Supabase", async () => {
    mockImagesQuery({ data: [], error: null });
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/route"
    );
    const request = new Request("https://example.com/api/villas/9/images", {
      headers: { "CF-Connecting-IP": "203.0.113.81" },
    });
    const context = { params: Promise.resolve({ id: "9" }) };

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicDetail.limit;
      index += 1
    ) {
      const response = await GET(request, context);
      expect(response.status).not.toBe(429);
    }

    createClientMock.mockClear();
    const blocked = await GET(request, context);

    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests.",
      retryAfterSeconds: 60,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid ids without querying Supabase", async () => {
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");

    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "1.5" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Invalid villa id" });
    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 error for backend failures", async () => {
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockImagesQuery({
      data: null,
      error: { message: "raw Supabase secret detail" },
    });

    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "9" }),
    });

    await expect(response.json()).resolves.toEqual({
      error: "Unable to load villa images",
    });
    expect(response.status).toBe(502);
    expect(consoleError).toHaveBeenCalled();
  });

  it("returns validated gallery image source URLs for the AWS image loader", async () => {
    mockImagesQuery({
      data: [
        {
          id: 7,
          property_id: 9,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: null,
          caption: "Pool",
          image_zone: "pool",
        },
      ],
      error: null,
    });
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");

    const response = await GET(
      new Request("https://example.com/api/villas/9/images"),
      { params: Promise.resolve({ id: "9" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.images).toEqual([
      expect.objectContaining({
        id: 7,
        imageUrl: "https://images.example.com/pool.jpg",
      }),
    ]);
  });

  it("proxies an allowed gallery image by image id", async () => {
    mockImagesQuery({
      data: [
        {
          id: 7,
          property_id: 9,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: null,
          caption: "Pool",
          image_zone: "pool",
        },
      ],
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("photo bytes", {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images?imageId=7&w=828&q=60",
        { headers: { Accept: "image/webp" } },
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.text()).resolves.toBe("photo bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://images.example.com/pool.jpg", {
      cache: "no-store",
      cf: {
        image: {
          fit: "scale-down",
          format: "webp",
          quality: 60,
          width: 828,
        },
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
  });

  it("proxies an allowed gallery image from the parent images route", async () => {
    mockImagesQuery({
      data: [
        {
          id: 7,
          property_id: 9,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: null,
          caption: "Pool",
          image_zone: "pool",
        },
      ],
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("photo bytes", {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg&w=828&q=60",
        { headers: { Accept: "image/webp" } },
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.text()).resolves.toBe("photo bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://images.example.com/pool.jpg", {
      cache: "no-store",
      cf: {
        image: {
          fit: "scale-down",
          format: "webp",
          quality: 60,
          width: 828,
        },
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
  });

  it("downloads an allowed gallery image from the parent images route", async () => {
    mockImagesQuery({
      data: [
        {
          id: 7,
          property_id: 9,
          cover_select: 1,
          image_name: "pool.jpg",
          image_url: null,
          caption: "Pool",
          image_zone: "pool",
        },
      ],
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("photo bytes", {
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/villas/[id]/images/route");

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images?download=1&url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.text()).resolves.toBe("photo bytes");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="villa-9-pool-pool.jpg"',
    );
  });
});
