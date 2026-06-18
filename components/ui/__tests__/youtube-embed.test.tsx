/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { YouTubeEmbed } from "../youtube-embed";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

describe("YouTubeEmbed", () => {
  it("falls back to videoId when embedUrl is not a trusted YouTube URL", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <YouTubeEmbed
            embedUrl="https://example.com/embed/unsafe"
            title="Villa video"
            videoId="safe-video"
          />,
        );
      });

      await act(async () => {
        container.querySelector("button")?.click();
      });

      expect(container.querySelector("iframe")?.getAttribute("src")).toContain(
        "https://www.youtube-nocookie.com/embed/safe-video?",
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
