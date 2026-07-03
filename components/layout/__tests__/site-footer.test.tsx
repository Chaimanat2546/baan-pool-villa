/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";

import { SiteFooter } from "../site-footer";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

function publicSettingsWithDuplicatePhoneContacts(): SiteSettings {
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

describe("SiteFooter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders duplicate phone contact values without duplicate React key warnings", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const page = await mountAdminPage(
      <SiteFooter settings={publicSettingsWithDuplicatePhoneContacts()} />,
    );

    expect(
      consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("Encountered two children with the same key"),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });
});
