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

function mockViewport(isDesktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: isDesktop,
      media: "(min-width: 1024px)",
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  );
}

describe("TikTokSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps only one TikTok player active when switching videos", async () => {
    mockViewport(true);
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

  it("keeps exactly six TikTok videos in the scrollable rail", async () => {
    const videos = Array.from({ length: 6 }, (_, index) => {
      const videoId = `7370000000000000${String(index + 1).padStart(3, "0")}`;

      return {
        url: `https://www.tiktok.com/@baanpoolvilla/video/${videoId}`,
        videoId,
      };
    });
    const page = await mountAdminPage(
      <TikTokSection tiktok={{ accountUrl: "", videos }} />,
    );

    expect(page.container.querySelector("[data-scroll-rail-viewport]")).not.toBeNull();
    expect(page.container.querySelector("[data-tiktok-grid]")).toBeNull();
    expect(page.container.querySelectorAll("[data-tiktok-poster]")).toHaveLength(6);

    await page.unmount();
  });

  it("opens a large TikTok player dialog on mobile", async () => {
    mockViewport(false);
    const page = await mountAdminPage(
      <TikTokSection
        tiktok={{
          accountUrl: "",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
            },
          ],
        }}
      />,
    );

    await click(page.container.querySelector("[data-tiktok-poster]") as HTMLElement);

    const dialog = page.container.querySelector("[data-tiktok-player-dialog]");
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain("z-[90]");
    expect(page.container.querySelectorAll("iframe")).toHaveLength(1);
    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);

    await click(
      page.container.querySelector(
        "[aria-label='ปิดวิดีโอ TikTok']",
      ) as HTMLElement,
    );
    expect(page.container.querySelector("[data-tiktok-player-dialog]")).toBeNull();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);

    await page.unmount();
  });

  it("loads only the signed TikTok thumbnail after the section activates", async () => {
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

    expect(activatedPage.container.querySelector("[data-progressive-preview]")).toBeNull();
    expect(
      activatedPage.container
        .querySelector("[data-progressive-full]")
        ?.getAttribute("src"),
    ).toBe(video.thumbnailUrl);
    await click(activatedPage.container.querySelector("[data-tiktok-poster]") as HTMLElement);
    expect(activatedPage.container.querySelectorAll("iframe")).toHaveLength(1);

    await activatedPage.unmount();
  });
});
