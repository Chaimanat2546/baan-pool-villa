import { describe, expect, it } from "vitest";

import {
  buildGuideContentImageProxyPath,
  buildGuideCoverImageProxyPath,
  buildTikTokThumbnailImageProxyUrl,
  isPublicImageProxyPath,
  buildGuideImageProxyUrl,
  buildSiteAssetProxyUrl,
  buildVillaCoverImageProxyPath,
  buildVillaCoverImageProxyUrl,
  buildVillaGalleryImageProxyPath,
  buildVillaGalleryImageProxyUrl,
} from "@/lib/public-image-proxy";

describe("public image proxy URL builders", () => {
  it("builds only allowlisted TikTok CDN preview proxy URLs", () => {
    const source =
      "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/no-extension?x-expires=123&x-signature=signed";
    const proxyUrl = buildTikTokThumbnailImageProxyUrl(source, {
      quality: 60,
      width: 64,
    });
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.pathname).toBe("/api/tiktok/images/proxy");
    expect(url.searchParams.get("url")).toBe(source);
    expect(url.searchParams.get("w")).toBe("64");
    expect(url.searchParams.get("q")).toBe("60");
    expect(buildTikTokThumbnailImageProxyUrl("https://tiktokcdn-us.com/cover.jpg")).toBeNull();
    expect(buildTikTokThumbnailImageProxyUrl("https://p16-sign.tiktokcdn-us.com.evil.test/cover.jpg")).toBeNull();
    expect(buildTikTokThumbnailImageProxyUrl("https://user:pass@p16-sign.tiktokcdn-us.com/cover.jpg")).toBeNull();
    expect(buildTikTokThumbnailImageProxyUrl("https://p16-sign.tiktokcdn-us.com:444/cover.jpg")).toBeNull();
    expect(buildTikTokThumbnailImageProxyUrl("http://p16-sign.tiktokcdn-us.com/cover.jpg")).toBeNull();
  });

  it("recognizes only documented same-origin image proxy routes", () => {
    expect(isPublicImageProxyPath("/api/guides/images/guide/cover")).toBe(true);
    expect(isPublicImageProxyPath("/api/houses")).toBe(false);
  });

  it("returns null instead of unsafe original URLs", () => {
    expect(buildGuideImageProxyUrl("http://assets.example.com/guide.jpg")).toBeNull();
    expect(
      buildSiteAssetProxyUrl("https://user:pass@assets.example.com/hero.jpg"),
    ).toBeNull();
    expect(buildVillaCoverImageProxyUrl("not a url")).toBeNull();
  });

  it("rejects internal and private network targets", () => {
    expect(buildGuideImageProxyUrl("https://localhost/1.jpg")).toBeNull();
    expect(buildGuideImageProxyUrl("https://127.0.0.1/1.jpg")).toBeNull();
    expect(buildGuideImageProxyUrl("https://169.254.169.254/1.jpg")).toBeNull();
    expect(buildSiteAssetProxyUrl("https://10.0.0.1/hero.jpg")).toBeNull();
    expect(buildSiteAssetProxyUrl("https://192.168.1.1/hero.jpg")).toBeNull();
    expect(buildVillaCoverImageProxyUrl("https://172.16.0.1/cover.jpg")).toBeNull();
    expect(buildVillaCoverImageProxyUrl("https://[::1]/cover.jpg")).toBeNull();
    expect(buildVillaCoverImageProxyUrl("https://[fd00::1]/cover.jpg")).toBeNull();
    expect(
      buildSiteAssetProxyUrl("https://user:pass@127.0.0.1/hero.jpg"),
    ).toBeNull();
  });

  it("builds same-origin proxy URLs for safe HTTPS image sources", () => {
    const proxyUrl = buildGuideImageProxyUrl("https://assets.example.com/guide.jpg");
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.pathname).toBe("/api/guides/images/proxy");
    expect(url.searchParams.get("url")).toBe(
      "https://assets.example.com/guide.jpg",
    );
  });

  it("adds allowlisted transform params to proxy URLs", () => {
    const proxyUrl = buildVillaCoverImageProxyUrl(
      "https://assets.example.com/cover.jpg",
      { quality: 60, width: 640 },
    );
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.pathname).toBe("/api/houses/images/proxy");
    expect(url.searchParams.get("url")).toBe(
      "https://assets.example.com/cover.jpg",
    );
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("builds id-based public image proxy paths without source URLs", () => {
    expect(
      buildVillaCoverImageProxyPath("501", { quality: 60, width: 640 }),
    ).toBe("/api/houses/images/501?w=640&q=60");
    expect(
      buildGuideCoverImageProxyPath("family-trip", {
        quality: 75,
        width: 1200,
      }),
    ).toBe("/api/guides/images/family-trip/cover?w=1200&q=75");
    expect(
      buildGuideContentImageProxyPath("family-trip", 3, {
        quality: 75,
        width: 1200,
      }),
    ).toBe("/api/guides/images/family-trip/content/3?w=1200&q=75");
    expect(
      buildVillaGalleryImageProxyPath("88", 7, {
        quality: 60,
        width: 828,
      }),
    ).toBe("/api/villas/88/images?imageId=7&w=828&q=60");
  });

  it("keeps quality 80 in public image proxy paths", () => {
    expect(
      buildGuideCoverImageProxyPath("family-trip", {
        quality: 80,
        width: 640,
      }),
    ).toBe("/api/guides/images/family-trip/cover?w=640&q=80");
  });

  it("omits unsupported transform params from generated proxy URLs", () => {
    const proxyUrl = buildSiteAssetProxyUrl(
      "https://assets.example.com/hero.jpg",
      { quality: 90, width: 999 },
    );
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.searchParams.has("w")).toBe(false);
    expect(url.searchParams.has("q")).toBe(false);
  });

  it("builds villa gallery proxy URLs with encoded listing ids and transforms", () => {
    const proxyUrl = buildVillaGalleryImageProxyUrl(
      "88",
      "https://assets.example.com/gallery.jpg",
      { quality: 75, width: 1920 },
    );
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.pathname).toBe("/api/villas/88/images");
    expect(url.searchParams.get("url")).toBe(
      "https://assets.example.com/gallery.jpg",
    );
    expect(url.searchParams.get("w")).toBe("1920");
    expect(url.searchParams.get("q")).toBe("75");
  });
});
