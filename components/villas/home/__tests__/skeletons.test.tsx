import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomeLoading from "../../../../app/(public)/(home)/loading";
import { LoadingSkeleton } from "../loading-skeleton";
import { VillaRailSkeleton } from "../villa-rail-skeleton";

describe("home skeletons", () => {
  it("composes the home loading shell from component skeletons", () => {
    const markup = renderToStaticMarkup(<LoadingSkeleton />);

    expect(markup).toContain('data-hero-section-skeleton="true"');
    expect(markup).toContain('data-villa-rail-skeleton="true"');
  });

  it("renders the actual home route loading wrapper", () => {
    const markup = renderToStaticMarkup(<HomeLoading />);

    expect(markup).toContain('data-hero-section-skeleton="true"');
    expect(markup).toContain('data-villa-rail-skeleton="true"');
  });

  it("keeps the rail skeleton static instead of rendering ScrollRail controls", () => {
    const markup = renderToStaticMarkup(<VillaRailSkeleton cardCount={2} />);

    expect(markup).toContain('data-villa-rail-skeleton="true"');
    expect(markup.match(/data-villa-card-skeleton="true"/g)).toHaveLength(2);
    expect(markup).not.toContain('aria-label="Previous"');
    expect(markup).not.toContain('aria-label="Next"');
  });
});
