/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VillaCardGalleryImages } from "../villa-card-gallery-images";

vi.mock("next/image", () => ({
  default: ({
    alt,
    loading,
    src,
  }: {
    alt: string;
    loading?: string;
    src: string;
  }) => (
    <span aria-label={alt} data-loading={loading} data-src={src} />
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("VillaCardGalleryImages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads detail images and swaps the main image when a thumbnail is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              images: [
                { imageUrl: "https://images.example.com/pool.jpg" },
                { imageUrl: "https://images.example.com/bedroom.jpg" },
                { imageUrl: "https://images.example.com/kitchen.jpg" },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaCardGalleryImages
          alt="Demo Villa"
          coverImageSrc="https://images.example.com/cover.jpg"
          villaId="501"
        />,
      );
    });
    await flushEffects();

    expect(fetch).toHaveBeenCalledWith(
      "/api/villas/501/images?view=card",
      { signal: expect.any(AbortSignal) },
    );
    expect(
      container
        .querySelector('[aria-label="Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/cover.jpg");

    const thirdThumbnail = Array.from(
      container.querySelectorAll("[aria-pressed]"),
    )[2];

    expect(thirdThumbnail).not.toBeNull();

    await act(async () => {
      thirdThumbnail?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(
      container
        .querySelector('[aria-label="Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/bedroom.jpg");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("can render static gallery images without fetching detail images", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaCardGalleryImages
          alt="Static Demo Villa"
          coverImageSrc="https://images.example.com/cover.jpg"
          staticImageUrls={[
            "https://images.example.com/pool.jpg",
            "https://images.example.com/bedroom.jpg",
          ]}
          villaId="501"
        />,
      );
    });
    await flushEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      container
        .querySelector("[data-villa-card-gallery-status]")
        ?.getAttribute("data-villa-card-gallery-status"),
    ).toBe("ready");
    expect(container.querySelectorAll("button")).toHaveLength(5);
    expect(
      container.querySelector("[data-villa-card-thumbnail-strip]")?.className,
    ).toContain("px-2");
    expect(
      container.querySelector("[data-villa-card-thumbnail-strip]")?.className,
    ).not.toContain("px-8");

    const scrollButtons = Array.from(
      container.querySelectorAll('button[aria-label^="เลื่อนรูปย่อย"]'),
    );

    expect(scrollButtons).toHaveLength(2);
    for (const button of scrollButtons) {
      expect(button.className).toContain("z-10");
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("eagerly loads only the first three gallery thumbnails", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaCardGalleryImages
          alt="Thumbnail Demo Villa"
          coverImageSrc="https://images.example.com/cover.jpg"
          staticImageUrls={[
            "https://images.example.com/pool.jpg",
            "https://images.example.com/bedroom.jpg",
            "https://images.example.com/kitchen.jpg",
            "https://images.example.com/lounge.jpg",
          ]}
          villaId="501"
        />,
      );
    });
    await flushEffects();

    const thumbnailLoadingModes = Array.from(
      container.querySelectorAll('span[aria-label=""]'),
    ).map((thumbnail) => thumbnail.getAttribute("data-loading"));

    expect(thumbnailLoadingModes).toEqual([
      "eager",
      "eager",
      "eager",
      "lazy",
      "lazy",
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the cover image when there are not enough gallery thumbnails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaCardGalleryImages
          alt="Sparse Demo Villa"
          coverImageSrc="https://images.example.com/cover.jpg"
          staticImageUrls={["https://images.example.com/pool.jpg"]}
          villaId="501"
        />,
      );
    });
    await flushEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      container
        .querySelector("[data-villa-card-gallery-status]")
        ?.getAttribute("data-villa-card-gallery-status"),
    ).toBe("empty");
    expect(
      container
        .querySelector('[aria-label="Sparse Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/cover.jpg");
    expect(
      container.querySelector("[data-villa-card-thumbnail-placeholder]"),
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("updates the main image when the thumbnail scroll buttons are clicked", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollIntoViewMock = vi.fn();
    const scrollToMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    HTMLElement.prototype.scrollTo = scrollToMock;

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaCardGalleryImages
          alt="Scrollable Demo Villa"
          coverImageSrc="https://images.example.com/cover.jpg"
          staticImageUrls={[
            "https://images.example.com/pool.jpg",
            "https://images.example.com/bedroom.jpg",
          ]}
          villaId="501"
        />,
      );
    });
    await flushEffects();
    scrollIntoViewMock.mockClear();

    const nextButton = container.querySelector(
      'button[aria-label="เลื่อนรูปย่อยของ Scrollable Demo Villa ไปทางขวา"]',
    );
    const previousButton = container.querySelector(
      'button[aria-label="เลื่อนรูปย่อยของ Scrollable Demo Villa ไปทางซ้าย"]',
    );

    expect(
      container
        .querySelector('[aria-label="Scrollable Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/cover.jpg");

    await act(async () => {
      nextButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(
      container
        .querySelector('[aria-label="Scrollable Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/pool.jpg");
    await flushEffects();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(scrollToMock).toHaveBeenCalledWith({
      behavior: "smooth",
      left: expect.any(Number),
    });

    await act(async () => {
      previousButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(
      container
        .querySelector('[aria-label="Scrollable Demo Villa"]')
        ?.getAttribute("data-src"),
    ).toBe("https://images.example.com/cover.jpg");

    act(() => {
      root.unmount();
    });
    container.remove();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    HTMLElement.prototype.scrollTo = originalScrollTo;
  });
});
