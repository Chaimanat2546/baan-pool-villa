/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  click,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: { alt: string; src: string }) => (
    <span {...props} aria-label={alt} data-src={src} />
  ),
}));

vi.mock("../tiktok-client-oembed", () => ({
  loadTikTokClientOEmbed: vi.fn().mockResolvedValue(null),
}));

import { TikTokSection } from "../tiktok-section";
import { toHomePageSettings } from "../client-payload";
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
              houseId: null,
            },
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002",
              videoId: "7370000000000000002",
              houseId: null,
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
        houseId: null,
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

  it("requests TikTok playback with sound when a selected player is ready", async () => {
    mockViewport(true);
    const page = await mountAdminPage(
      <TikTokSection
        tiktok={{
          accountUrl: "",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
              houseId: null,
            },
          ],
        }}
      />,
    );

    await click(page.container.querySelector("[data-tiktok-poster]") as HTMLElement);

    const iframe = page.container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: { postMessage },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { "x-tiktok-player": true, type: "onPlayerReady" },
        origin: "https://www.tiktok.com",
        source: iframe.contentWindow,
      }),
    );

    expect(postMessage).toHaveBeenCalledWith(
      { "x-tiktok-player": true, type: "play", value: undefined },
      "https://www.tiktok.com",
    );
    expect(postMessage).toHaveBeenCalledWith(
      { "x-tiktok-player": true, type: "unMute", value: undefined },
      "https://www.tiktok.com",
    );

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
              houseId: null,
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
    expect(page.container.querySelector("iframe")?.src).toContain("autoplay=0");
    expect(page.container.textContent).toContain("แตะปุ่มเล่นในวิดีโอเพื่อเปิดเสียง");
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
      houseId: null,
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

  it("renders a resolved villa link without starting TikTok playback", async () => {
    const page = await mountAdminPage(
      <TikTokSection
        tiktok={{
          accountUrl: "",
          videos: [
            {
              houseId: "501",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
              villa: { id: "501", title: "บ้านพูลวิลล่าชื่อปัจจุบัน" },
            },
          ],
        }}
      />,
    );

    const villaLink = page.container.querySelector(
      'a[href="/villas/501"]',
    ) as HTMLAnchorElement | null;

    expect(villaLink?.textContent).toContain("ดูรายละเอียดบ้านพัก");
    expect(villaLink?.textContent).toContain("บ้านพูลวิลล่าชื่อปัจจุบัน");
    expect(
      villaLink?.querySelector("[data-tiktok-villa-mobile-label]")?.textContent,
    ).toBe("ดูบ้านพัก");

    villaLink?.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    villaLink?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(page.container.querySelectorAll("iframe")).toHaveLength(0);
    expect(page.container.querySelector("[data-tiktok-poster]")).not.toBeNull();

    await page.unmount();
  });

  it("keeps only the resolved villa projection in the homepage payload", () => {
    const payload = toHomePageSettings(
      {
        ...DEFAULT_SITE_SETTINGS,
        tiktok: {
          accountUrl: "",
          videos: [
            {
              houseId: "501",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
              villa: { id: "501", title: "บ้านพูลวิลล่าชื่อปัจจุบัน" },
            },
          ],
        },
      },
      DEFAULT_SITE_CONTACT_SETTINGS,
    );

    expect(payload.tiktok.videos).toEqual([
      {
        url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
        videoId: "7370000000000000001",
        villa: { id: "501", title: "บ้านพูลวิลล่าชื่อปัจจุบัน" },
      },
    ]);
    expect(payload.tiktok.videos[0]).not.toHaveProperty("houseId");
  });

  it("omits the villa link when resolution returns null", async () => {
    const page = await mountAdminPage(
      <TikTokSection
        tiktok={{
          accountUrl: "",
          videos: [
            {
              houseId: "999",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
              villa: null,
            },
          ],
        }}
      />,
    );

    expect(page.container.querySelector('a[href^="/villas/"]')).toBeNull();

    await page.unmount();
  });
});
