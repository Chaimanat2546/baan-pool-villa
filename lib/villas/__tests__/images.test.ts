import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProxyImageUrl,
  fetchVillaImages,
  normalizeImageRows,
  normalizeImageUrl,
} from "../images";

vi.mock("server-only", () => ({}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/villas/images", async () => import("../images"));

const originalEnv = process.env;

function setSupabaseEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
}

function mockImagesQuery(response: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  const supabase = {
    from: vi.fn(() => query),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce(response);
  createClientMock.mockReturnValue(supabase);

  return { query, supabase };
}

beforeEach(() => {
  vi.restoreAllMocks();
  createClientMock.mockReset();
  process.env = { ...originalEnv };
  setSupabaseEnv();
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

  it("builds proxy image URLs from image_name before using raw image URLs", () => {
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
        imageUrl: "https://images.example.com/pool.jpg",
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
          "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/pool.jpg",
        imageName: "pool.jpg",
        caption: "Pool view",
        isCover: true,
        zone: "pattaya",
      },
      {
        id: 8,
        imageUrl:
          "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/missing.jpg",
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
});

describe("GET /api/villas/[id]/images", () => {
  it("returns 400 for invalid ids without querying Supabase", async () => {
    const { GET } = await import("../../../app/api/villas/[id]/images/route");

    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "1.5" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Invalid villa id" });
    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 error for backend failures", async () => {
    const { GET } = await import("../../../app/api/villas/[id]/images/route");
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
});
