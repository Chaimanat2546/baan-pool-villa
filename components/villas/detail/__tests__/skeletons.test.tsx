import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "../../../../app/(public)/villas/[id]/loading";
import { DetailLayoutSkeleton } from "../detail-layout-skeleton";
import { VillaDetailPageSkeleton } from "../detail-page-skeleton";
import { GallerySkeleton } from "../gallery-skeleton";

describe("detail skeletons", () => {
  it("keeps the gallery skeleton aligned with the real gallery desktop height", () => {
    const markup = renderToStaticMarkup(<GallerySkeleton />);

    expect(markup).toContain('data-gallery-skeleton="true"');
    expect(markup).toContain("lg:h-[500px]");
    expect(markup).toContain("lg:grid-cols-[3fr_2fr]");
  });

  it("composes route loading from detail component skeletons", () => {
    const markup = renderToStaticMarkup(<VillaDetailPageSkeleton />);

    expect(markup).toContain('data-villa-detail-page-skeleton="true"');
    expect(markup).toContain('data-gallery-skeleton="true"');
    expect(markup).toContain('data-villa-intro-skeleton="true"');
    expect(markup).toContain('data-detail-layout-skeleton="true"');
    expect(markup).toContain('data-booking-sidebar-skeleton="true"');
  });

  it("keeps the detail layout recommended rail static", () => {
    const markup = renderToStaticMarkup(<DetailLayoutSkeleton />);

    expect(markup).toContain('data-detail-recommended-rail-skeleton="true"');
    expect(markup).toContain('data-villa-card-skeleton="true"');
    expect(markup).not.toContain('data-villa-rail-skeleton="true"');
  });

  it("renders the detail page skeleton from the route loading file", () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-villa-detail-page-skeleton="true"');
    expect(markup).toContain('data-detail-layout-skeleton="true"');
  });
});
