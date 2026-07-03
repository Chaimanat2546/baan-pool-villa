/**
 * @vitest-environment jsdom
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "../../../lib/site-settings/defaults";
import { ContactSection } from "../contact-section";

function settingsWithDuplicatePhoneContacts() {
  return {
    ...DEFAULT_SITE_SETTINGS,
    contact: {
      ...DEFAULT_SITE_SETTINGS.contact,
      phoneContacts: [
        {
          name: "คุณคลีน",
          phone: "0994120787",
          time: "ช่วง 07.00-22.00",
        },
        {
          name: "คุณคลีน",
          phone: "0994120787",
          time: "ช่วง 07.00-22.00",
        },
      ],
    },
  };
}

describe("ContactSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the current bank account number", () => {
    const markup = renderToStaticMarkup(
      <ContactSection settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain("398-289-7482");
    expect(markup).not.toContain("137-1-17528-4");
  });

  it("renders editable contact and bank settings from site settings", () => {
    const markup = renderToStaticMarkup(
      <ContactSection
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          bank: {
            accountName: "คุณ อาภัสรา จินดาวา",
            bankName: "ธนาคารกสิกรไทย",
            accountNumber: "999-999-9999",
          },
          contact: {
            phoneContacts: [
              {
                name: "คุณทดสอบ",
                phone: "0991234567",
                time: "ช่วง 09.00-18.00",
              },
            ],
            messengerUrl: "https://www.facebook.com/custom",
            lineId: "@customline",
            lineUrl: "https://line.me/R/ti/p/@customline",
          },
        }}
      />,
    );

    expect(markup).toContain("999-999-9999");
    expect(markup).toContain("คุณ อาภัสรา จินดาวา");
    expect(markup).toContain("คุณทดสอบ");
    expect(markup).toContain("0991234567");
    expect(markup).toContain("@customline");
  });

  it("renders duplicate phone contact values without duplicate React key warnings", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const page = await mountAdminPage(
      <ContactSection settings={settingsWithDuplicatePhoneContacts()} />,
    );

    expect(
      consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("Encountered two children with the same key"),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });
});
