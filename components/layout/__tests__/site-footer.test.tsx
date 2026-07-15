/**
 * @vitest-environment jsdom
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";

import { SiteFooter } from "../site-footer";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    src,
  }: {
    alt: string;
    className?: string;
    src: string;
  }) => (
    <span aria-label={alt} className={className} data-src={src} />
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

  it("renders footer links and bank highlight with site color variables", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain("ชื่อบัญชี");
    expect(markup).toContain("ธนาคาร");
    expect(markup).toContain("เลขที่");
    expect(markup).toContain(DEFAULT_SITE_SETTINGS.bank.accountName);
    expect(markup).toContain(DEFAULT_SITE_SETTINGS.bank.bankName);
    expect(markup).toContain(DEFAULT_SITE_SETTINGS.bank.accountNumber);
    expect(markup).not.toContain(
      `${DEFAULT_SITE_SETTINGS.bank.bankName} เลขที่ ${DEFAULT_SITE_SETTINGS.bank.accountNumber}`,
    );
    expect(markup).toContain("text-[var(--site-bank-account-highlight)]");
    expect(markup).toContain("text-[var(--site-bank-name-highlight)]");
    expect(markup).toContain("text-[var(--site-bank-number-highlight)]");
    expect(markup).not.toContain("text-[var(--site-bank-highlight)]");
    expect(markup).toContain("text-[var(--site-footer-link)]");
    expect(markup).toContain("hover:text-[var(--site-footer-link-hover)]");
    expect(markup).not.toContain("text-[var(--site-on-primary)]");
  });

  it("applies the readable primary text color directly to the footer", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter
        settings={{ ...DEFAULT_SITE_SETTINGS, primaryColor: "#f8fafc" }}
      />,
    );

    expect(markup).toContain("--site-on-primary:#0f172a");
  });

  it("renders uploaded logos with the selected background and containment", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          logoBackground: "transparent",
        }}
      />,
    );

    expect(markup).toContain("bg-transparent");
    expect(markup).toContain("border-transparent");
    expect(markup).toContain("object-contain");
  });

  it("falls back to a white logo background for cached settings without a logo background", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          logoBackground: undefined,
        } as unknown as typeof DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain("bg-white");
    expect(markup).not.toContain("undefined");
  });
});
