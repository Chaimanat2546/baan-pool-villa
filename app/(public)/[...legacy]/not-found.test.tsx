import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("legacy public not-found route", () => {
  it("renders generic public 404 actions", () => {
    const markup = renderToStaticMarkup(<NotFound />);

    expect(markup).toContain("ไม่พบหน้าที่คุณกำลังหา");
    expect(markup).toContain('href="/search"');
    expect(markup).toContain('href="/guides"');
    expect(markup).toContain('href="/"');
  });
});
