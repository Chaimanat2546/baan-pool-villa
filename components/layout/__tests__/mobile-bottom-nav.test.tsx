import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { MobileBottomNav } from "../mobile-bottom-nav";

describe("MobileBottomNav", () => {
  it("renders chat actions as links so browser link actions still work", () => {
    const settings = {
      ...DEFAULT_SITE_CONTACT_SETTINGS,
      contact: {
        ...DEFAULT_SITE_CONTACT_SETTINGS.contact,
        lineId: "@customline",
      },
    };
    const markup = renderToStaticMarkup(
      <MobileBottomNav settings={settings} />,
    );

    expect(markup).toContain('aria-label="แชทผ่าน Messenger"');
    expect(markup).toContain(
      `href="${DEFAULT_SITE_CONTACT_SETTINGS.contact.messengerUrl}"`,
    );
    expect(markup).toContain('aria-label="ติดต่อผ่าน LINE"');
    expect(markup).toContain(`href="${DEFAULT_SITE_CONTACT_SETTINGS.contact.lineUrl}"`);
    expect(markup).toContain(`LINE ID : ${settings.contact.lineId}`);
  });

  it("does not render an empty LINE ID row", () => {
    const settings = {
      ...DEFAULT_SITE_CONTACT_SETTINGS,
      contact: { ...DEFAULT_SITE_CONTACT_SETTINGS.contact, lineId: "" },
    };

    expect(renderToStaticMarkup(<MobileBottomNav settings={settings} />)).not.toContain(
      "LINE ID :",
    );
  });
});
