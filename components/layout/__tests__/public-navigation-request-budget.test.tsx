import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";

import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

interface MockImageProps {
  alt: string;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, src }: MockImageProps) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

function expectDocumentNavigationLink(markup: string, href: string) {
  const escapedAttributeHref = href.replaceAll("&", "&amp;");
  const escapedHref = escapedAttributeHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anchor = markup.match(new RegExp(`<a\\b[^>]*href="${escapedHref}"[^>]*>`));

  expect(anchor?.[0]).toContain(`href="${escapedAttributeHref}"`);
  expect(anchor?.[0]).not.toContain("data-prefetch=");
}

function getFirstImageSrc(markup: string): string {
  const match = markup.match(/\bdata-src="([^"]+)"/);

  expect(match?.[1]).toBeDefined();

  return match?.[1].replaceAll("&amp;", "&") ?? "";
}

function publicSettingsWithRemoteLogo(): SiteSettings {
  return {
    ...DEFAULT_SITE_SETTINGS,
    logoImage: {
      ...DEFAULT_SITE_SETTINGS.logoImage,
      url: "https://assets.example.com/storage/v1/object/public/site-assets/logo.png",
    },
  };
}

describe("public navigation request budget", () => {
  it("does not viewport-prefetch header navigation routes", () => {
    const markup = renderToStaticMarkup(
      <SiteHeader contactSettings={DEFAULT_SITE_CONTACT_SETTINGS} settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectDocumentNavigationLink(markup, "/");
    expectDocumentNavigationLink(markup, "/search?guests=2&bedrooms=1&maxPrice=58900");
    expectDocumentNavigationLink(markup, "/guides");
    expectDocumentNavigationLink(
      markup,
      `tel:${DEFAULT_SITE_CONTACT_SETTINGS.contact.phoneContacts[0]?.phone}`,
    );
    expectDocumentNavigationLink(markup, DEFAULT_SITE_CONTACT_SETTINGS.contact.lineUrl);
  });

  it("does not viewport-prefetch footer navigation routes", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter contactSettings={DEFAULT_SITE_CONTACT_SETTINGS} settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectDocumentNavigationLink(markup, "/");
    expectDocumentNavigationLink(markup, "/search?guests=2&bedrooms=1&maxPrice=58900");
    expectDocumentNavigationLink(markup, "/guides");
    expectDocumentNavigationLink(markup, "/terms");
    expectDocumentNavigationLink(markup, "/privacy");
  });

  it("passes public header and footer logos to the AWS image loader", () => {
    const settings = publicSettingsWithRemoteLogo();
    const headerMarkup = renderToStaticMarkup(
      <SiteHeader contactSettings={DEFAULT_SITE_CONTACT_SETTINGS} settings={settings} />,
    );
    const footerMarkup = renderToStaticMarkup(
      <SiteFooter contactSettings={DEFAULT_SITE_CONTACT_SETTINGS} settings={settings} />,
    );

    expect(getFirstImageSrc(headerMarkup)).toBe(
      "/api/site-assets/images/logo",
    );
    expect(getFirstImageSrc(footerMarkup)).toBe(
      "/api/site-assets/images/logo",
    );
    expect(headerMarkup).toContain("/api/site-assets/images/logo");
    expect(footerMarkup).toContain("/api/site-assets/images/logo");
  });
});
