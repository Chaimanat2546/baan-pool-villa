import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
  const escapedHref = href.replace("/", "\\/");
  const anchor = markup.match(new RegExp(`<a\\b[^>]*href="${escapedHref}"[^>]*>`));

  expect(anchor?.[0]).toContain(`href="${href}"`);
  expect(anchor?.[0]).not.toContain("data-prefetch=");
}

function getFirstImageSrc(markup: string): string {
  const match = markup.match(/\bsrc="([^"]+)"/);

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
      <SiteHeader settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectDocumentNavigationLink(markup, "/");
    expectDocumentNavigationLink(markup, "/search");
    expectDocumentNavigationLink(markup, "/guides");
    expectDocumentNavigationLink(markup, "/#recommendations");
    expectDocumentNavigationLink(markup, "/#contact");
  });

  it("does not viewport-prefetch footer navigation routes", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectDocumentNavigationLink(markup, "/");
    expectDocumentNavigationLink(markup, "/search");
    expectDocumentNavigationLink(markup, "/guides");
    expectDocumentNavigationLink(markup, "/#recommendations");
  });

  it("routes public header and footer logos through the site asset proxy", () => {
    const settings = publicSettingsWithRemoteLogo();
    const headerMarkup = renderToStaticMarkup(<SiteHeader settings={settings} />);
    const footerMarkup = renderToStaticMarkup(<SiteFooter settings={settings} />);

    expect(getFirstImageSrc(headerMarkup)).toBe(
      "/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fsite-assets%2Flogo.png&w=128&q=75",
    );
    expect(getFirstImageSrc(footerMarkup)).toBe(
      "/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fsite-assets%2Flogo.png&w=160&q=75",
    );
    expect(headerMarkup).not.toContain('src="https://assets.example.com');
    expect(footerMarkup).not.toContain('src="https://assets.example.com');
  });
});
