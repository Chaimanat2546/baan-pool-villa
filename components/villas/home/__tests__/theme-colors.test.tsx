import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "../section-header";

describe("public themed UI colors", () => {
  it("renders section headings with semantic theme variables", () => {
    const markup = renderToStaticMarkup(
      <SectionHeader
        eyebrow="Featured"
        title="Pool villas"
        description="Hand-picked stays"
      />,
    );

    expect(markup).toContain("text-[var(--site-accent)]");
    expect(markup).toContain("text-[var(--site-text)]");
    expect(markup).toContain("text-[var(--site-muted)]");
    expect(markup).not.toContain("text-[#0f5a66]");
    expect(markup).not.toContain("text-[#063f35]");
    expect(markup).not.toContain("text-[#55746b]");
  });
});
