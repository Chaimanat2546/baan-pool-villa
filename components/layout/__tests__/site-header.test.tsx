import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { SiteHeader } from "../site-header";

describe("SiteHeader", () => {
  it("renders the bank account notice with readable navbar text tokens", () => {
    const markup = renderToStaticMarkup(
      <SiteHeader settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain(DEFAULT_SITE_SETTINGS.bank.accountNumber);
    expect(markup).toContain("text-[var(--site-on-primary)]");
    expect(markup).not.toContain(
      `<span class="text-[var(--site-accent)]">${DEFAULT_SITE_SETTINGS.bank.bankName}`,
    );
  });
});
