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

    expect(markup).toContain('data-src="https://assets.example.com/hero.jpg"');
    expect(markup).not.toContain("/api/site-assets/proxy");
  });
});
