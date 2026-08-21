/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockAutoplay, mockEmblaApi, mockUseEmblaCarousel } = vi.hoisted(() => ({
  mockAutoplay: vi.fn(() => ({ name: "autoplay" })),
  mockEmblaApi: { off: vi.fn(), on: vi.fn(), scrollNext: vi.fn(), scrollPrev: vi.fn(), scrollTo: vi.fn(), selectedScrollSnap: vi.fn(() => 0) },
  mockUseEmblaCarousel: vi.fn(() => [vi.fn(), mockEmblaApi]),
}));

vi.mock("embla-carousel-autoplay", () => ({ default: mockAutoplay }));
vi.mock("embla-carousel-react", () => ({ default: mockUseEmblaCarousel }));
vi.mock("@/components/ui/progressive-image", () => ({
  ProgressiveImage: ({ alt, className, src }: { alt: string; className?: string; src: string }) => <span aria-label={alt} data-image-class={className} data-src={src} data-progressive-image="true" />,
}));

import { HeroCarousel } from "../hero-carousel";
import { HeroSection } from "../hero-section";

afterEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });

describe("HeroSection", () => {
  it("renders only the first Hero image before the carousel enhancement loads", () => {
    const markup = renderToStaticMarkup(<HeroSection heroImage={{ alt: "Legacy hero", path: "/legacy.jpg", url: "/legacy.jpg" }} heroSlides={[{ alt: "First hero", path: "/first.jpg", url: "/first.jpg" }, { alt: "Second hero", path: "/second.jpg", url: "/second.jpg" }]} maxAvailablePrice={12000} zones={[{ label: "Jomtien", value: "jomtien" }]} />);

    expect(markup).toContain('data-hero-carousel-static="true"');
    expect(markup).toContain('data-src="/first.jpg"');
    expect(markup).not.toContain('data-src="/second.jpg"');
    expect(markup).not.toContain('aria-label="รูป Hero ถัดไป"');
  });

  it("initializes controls after the carousel module loads", () => {
    const markup = renderToStaticMarkup(<HeroCarousel slides={[{ alt: "First hero", src: "/first.jpg" }, { alt: "Second hero", src: "/second.jpg" }]} />);

    expect(mockAutoplay).toHaveBeenCalledWith({ delay: 15000, stopOnInteraction: false });
    expect(mockUseEmblaCarousel).toHaveBeenCalledWith({ loop: true }, expect.any(Array));
    expect(markup).toContain('aria-label="รูป Hero ถัดไป"');
  });

  it("keeps the configured Hero image fill behavior", () => {
    const markup = renderToStaticMarkup(<HeroCarousel slides={[{ alt: "First hero", src: "/first.jpg" }]} />);

    expect(markup).toContain('data-image-class="object-fill"');
    expect(markup).not.toContain('data-image-class="object-cover"');
  });

  it("delegates the next control to Embla after enhancement", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<HeroCarousel slides={[{ alt: "First hero", src: "/first.jpg" }, { alt: "Second hero", src: "/second.jpg" }]} />); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="รูป Hero ถัดไป"]')?.click(); });
    expect(mockEmblaApi.scrollNext).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    container.remove();
  });
});
