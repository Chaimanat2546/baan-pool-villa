import { describe, expect, it } from "vitest";

import {
  buildGuideImageProxyUrl,
  buildSiteAssetProxyUrl,
  buildVillaCoverImageProxyUrl,
} from "@/lib/public-image-proxy";

describe("public image proxy URL builders", () => {
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
});
