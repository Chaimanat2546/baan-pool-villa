import { buildSiteThemeCss } from "@/lib/site-settings/colors";

const HEX_COLOR_PATTERN = /^#?[\da-f]{6}$/i;
const DEFAULT_PRIMARY_COLOR = "#064e3b";
const DEFAULT_ACCENT_COLOR = "#eab308";
const DEFAULT_LINK_COLOR = "#ffffff";
const DEFAULT_HIGHLIGHT_COLOR = "#eab308";

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
  const css = buildSiteThemeCss(
    {
      accentColor: readHexColor(
        url.searchParams.get("accent"),
        DEFAULT_ACCENT_COLOR,
      ),
      bankHighlightColor: readHexColor(
        url.searchParams.get("bankHighlight"),
        DEFAULT_HIGHLIGHT_COLOR,
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
      "Cache-Control": "no-store",
      "Content-Type": "text/css; charset=utf-8",
    },
  });
}
