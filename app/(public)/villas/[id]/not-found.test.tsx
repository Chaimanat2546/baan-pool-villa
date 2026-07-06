import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("villa detail not-found route", () => {
  it("renders villa-specific 404 actions", () => {
    const markup = renderToStaticMarkup(<NotFound />);

    expect(markup).toContain("ไม่พบบ้านพักนี้");
    expect(markup).toContain("กลับไปค้นหาบ้านพัก");
    expect(markup).toContain(
      'href="/search?guests=2&amp;bedrooms=1&amp;maxPrice=58900"',
    );
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain('href="/guides"');
  });
});
