/* @vitest-environment jsdom */
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ loader, preload, quality, src, ...props }: Record<string, unknown>) => {
    delete props.fill;
    const renderedSrc = typeof loader === "function"
      ? loader({ quality, src, width: 640 })
      : src;

    return (
      <img
        {...props}
        data-preload={preload ? "true" : undefined}
        data-quality={quality}
        src={renderedSrc as string}
      />
    );
  },
}));

import { ProgressiveImage } from "../progressive-image";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderImage(props: Partial<ComponentProps<typeof ProgressiveImage>> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async mount() {
      await act(async () => {
        root.render(
          <div className="relative size-24">
            <ProgressiveImage
              alt="พูลวิลล่าริมทะเล"
              fill
              fullImageActive={false}
              previewActive
              sizes="290px"
              src="/api/houses/images/501"
              {...props}
            />
          </div>,
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ProgressiveImage", () => {
  it("renders only the bounded preview while the full image is inactive", async () => {
    const page = renderImage();
    await page.mount();

    expect(page.container.querySelector('[data-progressive-preview]')?.getAttribute("data-maximum-width")).toBe("64");
    expect(page.container.querySelector('[data-progressive-preview]')?.getAttribute("data-quality")).toBe("60");
    expect(page.container.querySelector('[data-progressive-preview]')?.className).toContain("scale-105");
    expect(page.container.querySelector('[data-progressive-preview]')?.className).toContain("blur-lg");
    expect(page.container.querySelector('[data-progressive-full]')).toBeNull();

    await page.unmount();
  });

  it("renders the preview and preloads only the active full image", async () => {
    const page = renderImage({ fullImageActive: true, fullImagePreload: true });
    await page.mount();

    expect(page.container.querySelector('[data-progressive-preview]')).not.toBeNull();
    expect(page.container.querySelector('[data-progressive-full]')?.getAttribute("data-preload")).toBe("true");
    expect(page.container.querySelector('[data-progressive-preview]')?.hasAttribute("data-preload")).toBe(false);

    await page.unmount();
  });

  it("shows a neutral fallback without creating an image request while inactive", async () => {
    const page = renderImage({ fullImageActive: false, previewActive: false });
    await page.mount();

    expect(page.container.querySelector("img")).toBeNull();
    expect(page.container.querySelector('[data-progressive-image-fallback]')).not.toBeNull();

    await page.unmount();
  });

  it("preserves non-fill dimensions for an inactive neutral fallback", async () => {
    const page = renderImage({
      fill: false,
      fullImageActive: false,
      height: 180,
      previewActive: false,
      width: 320,
    });
    await page.mount();

    expect(page.container.querySelector("img")).toBeNull();
    expect(page.container.querySelector('[data-progressive-image-fallback]')).not.toBeNull();
    expect(page.container.querySelector('[data-progressive-image]')?.getAttribute("style")).toContain(
      "width: 320px",
    );
    expect(page.container.querySelector('[data-progressive-image]')?.getAttribute("style")).toContain(
      "height: 180px",
    );

    await page.unmount();
  });

  it("uses the neutral fallback when the preview errors", async () => {
    const page = renderImage();
    await page.mount();

    await act(async () => {
      page.container.querySelector('[data-progressive-preview]')?.dispatchEvent(
        new Event("error", { bubbles: true }),
      );
    });

    expect(page.container.querySelector('[data-progressive-preview]')).toBeNull();
    expect(page.container.querySelector('[data-progressive-image-fallback]')).not.toBeNull();

    await page.unmount();
  });

  it("keeps the neutral fallback until the active full image loads after a preview error", async () => {
    const page = renderImage({ fullImageActive: true });
    await page.mount();

    await act(async () => {
      page.container.querySelector('[data-progressive-preview]')?.dispatchEvent(
        new Event("error", { bubbles: true }),
      );
    });

    expect(page.container.querySelector('[data-progressive-preview]')).toBeNull();
    expect(page.container.querySelector('[data-progressive-full]')?.className).toContain(
      "opacity-0",
    );
    expect(page.container.querySelector('[data-progressive-image-fallback]')).not.toBeNull();

    await act(async () => {
      page.container.querySelector('[data-progressive-full]')?.dispatchEvent(
        new Event("load", { bubbles: true }),
      );
    });

    expect(page.container.querySelector('[data-progressive-full]')?.className).toContain(
      "opacity-100",
    );
    expect(page.container.querySelector('[data-progressive-image-fallback]')).toBeNull();

    await page.unmount();
  });

  it("uses a bounded proxy source for a TikTok preview and leaves the full source unchanged", async () => {
    const source =
      "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/no-extension";
    const previewSrc =
      "/api/tiktok/images/proxy?url=https%3A%2F%2Fp16-sign.tiktokcdn-us.com%2Ftos-useast5-p-0068-tx%2Fno-extension&w=64&q=60";
    const page = renderImage({ fullImageActive: true, previewSrc, src: source });
    await page.mount();

    const previewSource = new URL(
      page.container.querySelector('[data-progressive-preview]')?.getAttribute("src") ?? "",
      "https://example.com",
    );
    const fullSource =
      page.container.querySelector('[data-progressive-full]')?.getAttribute("src");

    expect(previewSource.pathname).toBe("/api/tiktok/images/proxy");
    expect(previewSource.searchParams.get("url")).toBe(source);
    expect(previewSource.searchParams.get("w")).toBe("64");
    expect(previewSource.searchParams.get("q")).toBe("60");
    expect(fullSource).toBe(source);
    expect(previewSource.href).not.toBe(fullSource);

    await page.unmount();
  });

  it("retains the preview when the full image errors", async () => {
    const page = renderImage({ fullImageActive: true });
    await page.mount();

    await act(async () => {
      page.container.querySelector('[data-progressive-full]')?.dispatchEvent(
        new Event("error", { bubbles: true }),
      );
    });

    expect(page.container.querySelector('[data-progressive-preview]')).not.toBeNull();
    expect(page.container.querySelector('[data-progressive-image-fallback]')).toBeNull();

    await page.unmount();
  });

  it("forwards the full image loading mode", async () => {
    const page = renderImage({ fullImageActive: true, fullImageLoading: "eager" });
    await page.mount();

    expect(page.container.querySelector('[data-progressive-full]')?.getAttribute("loading")).toBe("eager");

    await page.unmount();
  });

  it("renders an immediately visible full image before its load event", async () => {
    const page = renderImage({
      fullImageActive: true,
      fullImageVisibleImmediately: true,
    });
    await page.mount();

    const fullImage = page.container.querySelector('[data-progressive-full]');

    expect(fullImage?.className).toContain("opacity-100");
    expect(fullImage?.className).not.toContain("transition-opacity");

    await page.unmount();
  });

  it("does not apply the decorative full-image transition for reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    }));
    const page = renderImage({ fullImageActive: true });
    await page.mount();

    expect(page.container.querySelector('[data-progressive-full]')?.className).not.toContain(
      "transition-opacity",
    );

    await page.unmount();
  });
});
