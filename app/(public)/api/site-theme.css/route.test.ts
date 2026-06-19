import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/api/site-theme.css", () => {
  it("returns scoped theme CSS for valid query values", async () => {
    const response = GET(
      new Request(
        "https://example.com/api/site-theme.css?primary=%23064e3b&accent=%23eab308&scope=settings-preview-theme",
      ),
    );
    const css = await response.text();

    expect(response.headers.get("Content-Type")).toBe(
      "text/css; charset=utf-8",
    );
    expect(css).toContain(".settings-preview-theme{");
    expect(css).toContain("--site-primary:#064e3b");
  });

  it("falls back when query values are invalid", async () => {
    const response = GET(
      new Request(
        "https://example.com/api/site-theme.css?primary=javascript:alert(1)&accent=red&scope=x;body",
      ),
    );
    const css = await response.text();

    expect(css).toContain(".site-theme{");
    expect(css).toContain("--site-primary:#064e3b");
    expect(css).not.toContain("javascript");
    expect(css).not.toContain("x;body");
  });
});
