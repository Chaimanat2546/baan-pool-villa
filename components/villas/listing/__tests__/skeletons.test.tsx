import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VillaCardSkeleton } from "../villa-card-skeleton";
import { VillaGridSkeleton } from "../villa-grid-skeleton";

describe("listing skeletons", () => {
  it("keeps the villa card image placeholder height aligned with VillaCard", () => {
    const markup = renderToStaticMarkup(<VillaCardSkeleton />);

    expect(markup).toContain('data-villa-card-skeleton="true"');
    expect(markup).toContain("h-[216px]");
    expect(markup).toContain("min-h-[64px]");
    expect(markup).toContain("rounded-[24px]");
  });

  it("renders the requested number of card placeholders", () => {
    const markup = renderToStaticMarkup(<VillaGridSkeleton count={3} />);

    expect(markup).toContain('data-villa-grid-skeleton="true"');
    expect(markup.match(/data-villa-card-skeleton="true"/g)).toHaveLength(3);
  });
});
