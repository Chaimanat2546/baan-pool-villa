import {
  buildSiteThemeCss,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LINK_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from "@/lib/site-settings/colors";
import { CACHE_HEADERS } from "@/lib/cache-policy";

const HEX_COLOR_PATTERN = /^#?[\da-f]{6}$/i;

export const dynamic = "force-dynamic";

function readHexColor(value: string | null, fallback: string): string {
  const color = value?.trim().toLowerCase();

  if (!color || !HEX_COLOR_PATTERN.test(color)) {
    return fallback;
  }

  return color.startsWith("#") ? color : `#${color}`;
}

function readCssScope(value: string | null): string {
  const scope = value?.trim() ?? "";

  return /^[a-z][a-z0-9-]{0,39}$/.test(scope) ? scope : "site-theme";
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const bankHighlightColor = readHexColor(
    url.searchParams.get("bankHighlight"),
    DEFAULT_HIGHLIGHT_COLOR,
  );
  const css = buildSiteThemeCss(
    {
      accentColor: readHexColor(
        url.searchParams.get("accent"),
        DEFAULT_ACCENT_COLOR,
      ),
      bankHighlightColor,
      bankAccountHighlightColor: readHexColor(
        url.searchParams.get("bankAccountHighlight"),
        bankHighlightColor,
      ),
      bankNameHighlightColor: readHexColor(
        url.searchParams.get("bankNameHighlight"),
        bankHighlightColor,
      ),
      bankNumberHighlightColor: readHexColor(
        url.searchParams.get("bankNumberHighlight"),
        bankHighlightColor,
      ),
      footerLinkColor: readHexColor(
        url.searchParams.get("footerLink"),
        DEFAULT_LINK_COLOR,
      ),
      footerLinkHoverColor: readHexColor(
        url.searchParams.get("footerLinkHover"),
        DEFAULT_HIGHLIGHT_COLOR,
      ),
      headerLinkColor: readHexColor(
        url.searchParams.get("headerLink"),
        DEFAULT_LINK_COLOR,
      ),
      headerLinkHoverColor: readHexColor(
        url.searchParams.get("headerLinkHover"),
        DEFAULT_HIGHLIGHT_COLOR,
      ),
      primaryColor: readHexColor(
        url.searchParams.get("primary"),
        DEFAULT_PRIMARY_COLOR,
      ),
    },
    readCssScope(url.searchParams.get("scope")),
  );

  return new Response(css, {
    headers: {
      "Cache-Control": CACHE_HEADERS.siteThemeCss,
      "Content-Type": "text/css; charset=utf-8",
    },
  });
}
