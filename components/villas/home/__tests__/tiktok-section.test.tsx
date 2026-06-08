/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  click,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("../tiktok-client-oembed", () => ({
  loadTikTokClientOEmbed: vi.fn().mockResolvedValue(null),
}));

import { TikTokSection } from "../tiktok-section";

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
});
