/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  click,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: { alt: string; src: string }) => (
    <span {...props} aria-label={alt} data-src={src} />
  ),
}));

vi.mock("../tiktok-client-oembed", () => ({
  loadTikTokClientOEmbed: vi.fn().mockResolvedValue(null),
}));

import { TikTokSection } from "../tiktok-section";
import { ImageActivationContext } from "@/components/ui/near-viewport-activation";

describe("TikTokSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps only one TikTok player active when switching videos", async () => {
    const page = await mountAdminPage(
      <TikTokSection
        tiktok={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
            },
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002",
              videoId: "7370000000000000002",
            },
          ],
        }}
      />,
    );

    const posters = page.container.querySelectorAll("[data-tiktok-poster]");
    expect(posters).toHaveLength(2);

    await click(posters[0] as HTMLElement);
    expect(page.container.querySelectorAll("iframe")).toHaveLength(1);
    expect(
      page.container.querySelector('iframe[src*="7370000000000000001"]'),
    ).not.toBeNull();

    await click(posters[1] as HTMLElement);
    expect(page.container.querySelectorAll("iframe")).toHaveLength(1);
    expect(
      page.container.querySelector('iframe[src*="7370000000000000002"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector('iframe[src*="7370000000000000001"]'),
    ).toBeNull();

    await page.unmount();
  });

  it("keeps an inactive thumbnail poster neutral until the section activates", async () => {
    const video = {
      authorName: "Baan Pool Villa",
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/cover.jpg",
      title: "พูลวิลล่าวิวทะเล",
      url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
      videoId: "7370000000000000001",
    };
    const page = await mountAdminPage(
      <ImageActivationContext value={false}>
        <TikTokSection tiktok={{ accountUrl: "", videos: [video] }} />
      </ImageActivationContext>,
    );

    expect(page.container.querySelector("[data-tiktok-poster]")).not.toBeNull();
    expect(page.container.querySelector("[data-progressive-full]")).toBeNull();
    expect(page.container.querySelector("[data-progressive-image-fallback]")).not.toBeNull();

    await page.unmount();

    const activatedPage = await mountAdminPage(
      <ImageActivationContext value>
        <TikTokSection tiktok={{ accountUrl: "", videos: [video] }} />
      </ImageActivationContext>,
    );

    expect(activatedPage.container.querySelector("[data-progressive-full]")).not.toBeNull();
    const previewSource = new URL(
      activatedPage.container
        .querySelector("[data-progressive-preview]")
        ?.getAttribute("data-src") ?? "",
      "https://example.com",
    );
    expect(previewSource.pathname).toBe("/api/tiktok/images/proxy");
    expect(previewSource.searchParams.get("url")).toBe(video.thumbnailUrl);
    expect(previewSource.searchParams.get("w")).toBe("64");
    expect(previewSource.searchParams.get("q")).toBe("60");
    await click(activatedPage.container.querySelector("[data-tiktok-poster]") as HTMLElement);
    expect(activatedPage.container.querySelectorAll("iframe")).toHaveLength(1);

    await activatedPage.unmount();
  });
});
