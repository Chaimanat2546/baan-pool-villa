import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { MobileBottomNav } from "../mobile-bottom-nav";

describe("MobileBottomNav", () => {
  it("renders chat actions as links so browser link actions still work", () => {
    const markup = renderToStaticMarkup(
      <MobileBottomNav settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain('aria-label="แชทผ่าน Messenger"');
    expect(markup).toContain(
      `href="${DEFAULT_SITE_SETTINGS.contact.messengerUrl}"`,
    );
    expect(markup).toContain('aria-label="ติดต่อผ่าน LINE"');
    expect(markup).toContain(`href="${DEFAULT_SITE_SETTINGS.contact.lineUrl}"`);
  });
});
