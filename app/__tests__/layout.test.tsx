import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Prompt: () => ({
    variable: "--font-prompt",
  }),
}));

import RootLayout from "../layout";

describe("RootLayout", () => {
  it("keeps body text selectable for copy-friendly content", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>Selectable content</div>
      </RootLayout>,
    );

    expect(markup).not.toContain("select-none");
  });

  it("installs a guarded chunk load recovery script", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>Page content</div>
      </RootLayout>,
    );

    expect(markup).toContain('data-bpv-chunk-recovery="true"');
    expect(markup).toContain("ChunkLoadError");
    expect(markup).toContain("sessionStorage.getItem(retryKey)");
    expect(markup).toContain("/_next/static/chunks/");
  });
});
