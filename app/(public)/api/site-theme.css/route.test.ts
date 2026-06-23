import { describe, expect, it } from "vitest";

import { dynamic, GET } from "./route";

describe("/api/site-theme.css", () => {
  it("opts out of route and edge caching because colors are query driven", () => {
    const response = GET(
      new Request(
        "https://example.com/api/site-theme.css?primary=%23ff0000&accent=%23eab308",
      ),
    );

    expect(dynamic).toBe("force-dynamic");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

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

  it("accepts hashless hex query values from production stylesheet URLs", async () => {
    const response = GET(
      new Request(
        "https://example.com/api/site-theme.css?primary=ff0000&accent=eab308&scope=site-theme",
      ),
    );
    const css = await response.text();

    expect(css).toContain("--site-primary:#eb0002");
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
