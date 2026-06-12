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

  it("builds same-origin proxy URLs for safe HTTPS image sources", () => {
    const proxyUrl = buildGuideImageProxyUrl("https://assets.example.com/guide.jpg");
    const url = new URL(proxyUrl ?? "", "https://example.com");

    expect(url.pathname).toBe("/api/guides/images/proxy");
    expect(url.searchParams.get("url")).toBe(
      "https://assets.example.com/guide.jpg",
    );
  });
});
