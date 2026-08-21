/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAutoplay, mockEmblaApi, mockUseEmblaCarousel } = vi.hoisted(() => ({
  mockAutoplay: vi.fn(() => ({ name: "autoplay" })),
  mockEmblaApi: {
    off: vi.fn(),
    on: vi.fn(),
    scrollNext: vi.fn(),
    scrollPrev: vi.fn(),
    scrollTo: vi.fn(),
    selectedScrollSnap: vi.fn(() => 0),
  },
  mockUseEmblaCarousel: vi.fn(() => [vi.fn(), mockEmblaApi]),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    src,
  }: {
    alt: string;
    className?: string;
    src: string;
  }) => (
    <span aria-label={alt} data-class={className} data-src={src} />
  ),
}));

vi.mock("embla-carousel-autoplay", () => ({
  default: mockAutoplay,
}));

vi.mock("embla-carousel-react", () => ({
  default: mockUseEmblaCarousel,
}));

vi.mock("@/components/ui/progressive-image", () => ({
  ProgressiveImage: ({
    alt,
    fill,
    fullImageActive,
    fullImageFetchPriority,
    fullImageLoading,
    fullImagePreload,
    previewFetchPriority,
    previewLoading,
    previewMaximumWidth,
    previewActive,
    quality,
    sizes,
    src,
  }: {
    alt: string;
    fill?: boolean;
    fullImageActive: boolean;
    fullImageFetchPriority?: string;
    fullImageLoading?: string;
    fullImagePreload?: boolean;
    previewFetchPriority?: string;
    previewLoading?: string;
    previewMaximumWidth?: number;
    previewActive: boolean;
    quality?: number;
    sizes?: string;
    src: string;
  }) => (
    <span
      aria-label={alt}
      data-fill={fill ? "true" : undefined}
      data-progressive-image="true"
      data-quality={quality}
      data-sizes={sizes}
      data-src={src}
    >
      {previewActive ? <span data-progressive-preview="true" /> : null}
      {previewFetchPriority ? (
        <span data-progressive-preview-fetch-priority={previewFetchPriority} />
      ) : null}
      {previewLoading ? (
        <span data-progressive-preview-loading={previewLoading} />
      ) : null}
      {previewMaximumWidth ? (
        <span data-progressive-preview-maximum-width={previewMaximumWidth} />
      ) : null}
      {fullImageActive ? <span data-progressive-full="true" /> : null}
      {fullImagePreload ? <span data-progressive-full-preload="true" /> : null}
      {fullImageFetchPriority ? (
        <span data-progressive-full-fetch-priority={fullImageFetchPriority} />
      ) : null}
      {fullImageLoading ? (
        <span data-progressive-full-loading={fullImageLoading} />
      ) : null}
    </span>
  ),
}));

import { HeroSection } from "../hero-section";

describe("HeroSection", () => {
  beforeEach(() => {
    mockEmblaApi.selectedScrollSnap.mockReturnValue(0);
    mockEmblaApi.scrollNext.mockClear();
    mockEmblaApi.scrollPrev.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("activates full hero images monotonically after Embla selects a slide", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HeroSection
          heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }}
          heroSlides={[
            { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
            { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
            { alt: "Third hero", path: "/third.jpg", url: "/third.jpg" },
          ]}
          maxAvailablePrice={12000}
          zones={[{ label: "Jomtien", value: "jomtien" }]}
        />,
      );
    });

    expect(container.querySelectorAll("[data-progressive-preview]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-progressive-full]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-progressive-full-preload]")).toHaveLength(0);
    expect(
      container.querySelector('[data-src="/first.jpg"] [data-progressive-full]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-src="/second.jpg"] [data-progressive-full]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-src="/third.jpg"] [data-progressive-full]'),
    ).toBeNull();

    mockEmblaApi.selectedScrollSnap.mockReturnValue(1);
    const selectHandler = mockEmblaApi.on.mock.calls.find(
      ([eventName]) => eventName === "select",
    )?.[1] as (() => void) | undefined;

    await act(async () => {
      selectHandler?.();
    });

    expect(container.querySelectorAll("[data-progressive-preview]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-progressive-full]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-progressive-full-preload]")).toHaveLength(0);
    expect(
      container.querySelector('[data-src="/first.jpg"] [data-progressive-full]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-src="/second.jpg"] [data-progressive-full]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-src="/third.jpg"] [data-progressive-full]'),
    ).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the first configured slide with carousel controls", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        heroImage={{
          alt: "Legacy hero",
          path: "/legacy.jpg",
          url: "/legacy.jpg",
        }}
        heroSlides={[
          { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
          { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
        ]}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain('data-hero-carousel="true"');
    expect(markup).toContain('data-src="/first.jpg"');
    expect(markup).toContain('data-progressive-preview="true"');
    expect(markup).toContain('data-progressive-full="true"');
    expect(markup).not.toContain('data-progressive-full-preload="true"');
    expect(markup).toContain('data-progressive-full-fetch-priority="high"');
    expect(markup).toContain('data-progressive-preview-fetch-priority="high"');
    expect(markup).toContain('data-progressive-preview-loading="eager"');
    expect(markup).toContain('data-progressive-preview-maximum-width="96"');
    expect(markup).toContain('aria-label="รูป Hero ก่อนหน้า"');
    expect(markup).toContain('aria-label="รูป Hero ถัดไป"');
    expect(markup).toContain('aria-label="แสดงรูป Hero ที่ 2"');
  });

  it("initializes Embla as a looping autoplay carousel", () => {
    renderToStaticMarkup(
      <HeroSection
        heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }}
        heroSlides={[
          { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
          { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
        ]}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(mockAutoplay).toHaveBeenCalledWith({
      delay: 15000,
      stopOnInteraction: false,
    });
    expect(mockUseEmblaCarousel).toHaveBeenCalledWith(
      { loop: true },
      expect.any(Array),
    );
  });

  it("delegates the next control to Embla", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HeroSection
          heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }}
          heroSlides={[
            { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
            { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
          ]}
          maxAvailablePrice={12000}
          zones={[{ label: "Jomtien", value: "jomtien" }]}
        />,
      );
    });

    const nextButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="รูป Hero ถัดไป"]',
    );
    await act(async () => {
      nextButton?.click();
    });
    expect(mockEmblaApi.scrollNext).toHaveBeenCalledOnce();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("delegates carousel arrow keys to Embla and prevents their browser defaults", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HeroSection
          heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }}
          heroSlides={[
            { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
            { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
          ]}
          maxAvailablePrice={12000}
          zones={[{ label: "Jomtien", value: "jomtien" }]}
        />,
      );
    });

    const carousel = container.querySelector<HTMLElement>('[role="region"]');
    const leftArrowEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowLeft",
    });
    const rightArrowEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowRight",
    });

    await act(async () => {
      carousel?.dispatchEvent(leftArrowEvent);
      carousel?.dispatchEvent(rightArrowEvent);
    });

    expect(leftArrowEvent.defaultPrevented).toBe(true);
    expect(rightArrowEvent.defaultPrevented).toBe(true);
    expect(mockEmblaApi.scrollPrev).toHaveBeenCalledOnce();
    expect(mockEmblaApi.scrollNext).toHaveBeenCalledOnce();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders every configured hero image in the Embla track", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }}
        heroSlides={[
          { alt: "First hero", path: "/first.jpg", url: "/first.jpg" },
          { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" },
        ]}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain('data-src="/first.jpg"');
    expect(markup).toContain('data-src="/second.jpg"');
    expect(markup).toContain('data-fill="true"');
    expect(markup).toContain('data-quality="75"');
    expect(markup).toContain('data-sizes="100vw"');
  });

  it("keeps the legacy single image fallback without carousel controls", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        heroImage={{
          alt: "Hero image",
          path: "/hero.jpg",
          url: "/hero.jpg",
        }}
        heroSlides={[]}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain('data-src="/hero.jpg"');
    expect(markup).not.toContain('data-hero-carousel="true"');
    expect(markup).not.toContain('aria-label="รูป Hero ก่อนหน้า"');
  });

  it("renders a dedicated mobile search entry point on the home hero", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        heroImage={{
          alt: "Hero image",
          path: "/hero.jpg",
          url: "/hero.jpg",
        }}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain('data-home-mobile-search="true"');
  });

  it("passes the hero image to the AWS image loader", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        heroImage={{
          alt: "Hero image",
          path: "hero.jpg",
          url: "https://assets.example.com/hero.jpg",
        }}
        maxAvailablePrice={12000}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain("/api/site-assets/images/hero");
  });
});
