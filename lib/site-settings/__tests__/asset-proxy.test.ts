import { beforeEach, describe, expect, it, vi } from "vitest";
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
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });
});
