import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

import { HeroSection } from "../hero-section";

describe("HeroSection", () => {
  it("renders a dedicated mobile search entry point on the home hero", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        filters={{
          amenities: [],
          bedrooms: 4,
          guests: 8,
          maxPrice: 12000,
          nearSea: false,
          sort: "default",
          villaId: "",
          zone: "all",
        }}
        heroImage={{
          alt: "Hero image",
          path: "/hero.jpg",
          url: "/hero.jpg",
        }}
        maxAvailablePrice={12000}
        onChange={() => {}}
        onSearch={() => {}}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain('data-home-mobile-search="true"');
  });

  it("renders the hero image through the public site asset proxy", () => {
    const markup = renderToStaticMarkup(
      <HeroSection
        filters={{
          amenities: [],
          bedrooms: 4,
          guests: 8,
          maxPrice: 12000,
          nearSea: false,
          sort: "default",
          villaId: "",
          zone: "all",
        }}
        heroImage={{
          alt: "Hero image",
          path: "hero.jpg",
          url: "https://assets.example.com/hero.jpg",
        }}
        maxAvailablePrice={12000}
        onChange={() => {}}
        onSearch={() => {}}
        zones={[{ label: "Jomtien", value: "jomtien" }]}
      />,
    );

    expect(markup).toContain(
      'data-src="/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fhero.jpg&amp;w=1920&amp;q=75"',
    );
  });
});
