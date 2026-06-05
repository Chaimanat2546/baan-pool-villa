import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

interface MockLinkProps {
  children: ReactNode;
  href: string;
  prefetch?: boolean;
}

interface MockImageProps {
  alt: string;
  src: string;
}

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: MockLinkProps) => (
    <a data-prefetch={prefetch === false ? "false" : "auto"} href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: MockImageProps) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

function expectLinkPrefetchDisabled(markup: string, href: string) {
  expect(markup).toContain(`data-prefetch="false" href="${href}"`);
}

describe("public navigation request budget", () => {
  it("does not viewport-prefetch header navigation routes", () => {
    const markup = renderToStaticMarkup(
      <SiteHeader settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectLinkPrefetchDisabled(markup, "/");
    expectLinkPrefetchDisabled(markup, "/search");
    expectLinkPrefetchDisabled(markup, "/guides");
    expectLinkPrefetchDisabled(markup, "/#recommendations");
    expectLinkPrefetchDisabled(markup, "/#contact");
  });

  it("does not viewport-prefetch footer navigation routes", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter settings={DEFAULT_SITE_SETTINGS} />,
    );

    expectLinkPrefetchDisabled(markup, "/");
    expectLinkPrefetchDisabled(markup, "/search");
    expectLinkPrefetchDisabled(markup, "/guides");
    expectLinkPrefetchDisabled(markup, "/#recommendations");
  });
});
