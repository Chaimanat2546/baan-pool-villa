import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminSectionsHeader } from "../admin-sections-header";

describe("admin themed UI colors", () => {
  it("uses semantic theme variables in admin section controls", () => {
    const markup = renderToStaticMarkup(
      <AdminSectionsHeader
        activeSectionsCount={1}
        hasUnsavedChanges
        isLoading={false}
        isSaving={false}
        onAddSection={vi.fn()}
        onSave={vi.fn()}
        sectionsCount={2}
      />,
    );

    expect(markup).toContain("var(--site-primary)");
    expect(markup).toContain("var(--site-text)");
    expect(markup).toContain("var(--site-muted)");
    expect(markup).toContain("var(--site-border)");
    expect(markup).not.toContain("#063f35");
    expect(markup).not.toContain("#064e3b");
    expect(markup).not.toContain("#0f6b52");
  });
});
