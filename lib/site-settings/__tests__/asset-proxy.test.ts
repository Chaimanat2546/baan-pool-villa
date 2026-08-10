import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

vi.mock("server-only", () => ({}));

const { getSiteSettingsMock } = vi.hoisted(() => ({
  getSiteSettingsMock: vi.fn(),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: getSiteSettingsMock,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  getSiteSettingsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/site-assets/proxy", () => {
  it("returns 400 when the site asset URL is missing or unsafe", async () => {
    const { GET } = await import("../../../app/(public)/api/site-assets/proxy/route");

    const response = await GET(
      new Request("https://example.com/api/site-assets/proxy?url=http://x.test/a.jpg"),
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid image URL" });
    expect(response.status).toBe(400);
    expect(getSiteSettingsMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested URL is not an active public site asset", async () => {
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_SETTINGS,
      source: "config",
    });
    const { GET } = await import("../../../app/(public)/api/site-assets/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fother.jpg",
      ),
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
  });

  it("proxies the active hero image with public display cache headers", async () => {
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        heroImage: {
          alt: "Hero",
          path: "hero.jpg",
          url: "https://assets.example.com/hero.jpg",
        },
      },
      source: "config",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("hero bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/site-assets/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fhero.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("hero bytes");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000",
    );
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("matches active site asset URLs after canonical normalization", async () => {
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        heroImage: {
          alt: "Hero",
          path: "hero.jpg",
          url: " https://ASSETS.example.com/hero.jpg ",
        },
      },
      source: "config",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("hero bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/site-assets/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fhero.jpg",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("hero bytes");
  });
});

describe("GET /api/site-assets/images/[asset]", () => {
  it("falls back to the first hero slide when the requested index is invalid", async () => {
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        heroImage: {
          alt: "Hero",
          path: "hero.jpg",
          url: "https://assets.example.com/hero.jpg",
        },
        heroSlides: [
          {
            alt: "Hero",
            path: "hero.jpg",
            url: "https://assets.example.com/hero.jpg",
          },
        ],
      },
      source: "config",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("hero bytes", { headers: { "Content-Type": "image/webp" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/site-assets/images/[asset]/route"
    );

    const response = await GET(
      new Request(
        `https://example.com/api/site-assets/images/hero?slide=${"9".repeat(128)}`,
      ),
      { params: Promise.resolve({ asset: "hero" }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://assets.example.com/hero.jpg",
      expect.objectContaining({ redirect: "manual" }),
    );
  });
});
