import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "../../../../app/(public)/search/loading";
import { SearchLoadingSkeleton } from "../search-loading-skeleton";

describe("search skeletons", () => {
  it("composes the search loading shell from listing skeletons", () => {
    const markup = renderToStaticMarkup(<SearchLoadingSkeleton />);

    expect(markup).toContain('data-villa-grid-skeleton="true"');
    expect(markup.match(/data-villa-card-skeleton="true"/g)).toHaveLength(6);
  });

  it("renders the actual search route loading wrapper", () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-villa-grid-skeleton="true"');
    expect(markup).toContain('data-villa-card-skeleton="true"');
  });
});
