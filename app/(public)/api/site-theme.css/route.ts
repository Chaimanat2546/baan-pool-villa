import { CACHE_REVALIDATE_SECONDS } from "@/lib/cache-policy";
import { buildSiteThemeCss } from "@/lib/site-settings/colors";

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const DEFAULT_PRIMARY_COLOR = "#064e3b";
const DEFAULT_ACCENT_COLOR = "#eab308";

function readHexColor(value: string | null, fallback: string): string {
  const color = value?.trim().toLowerCase();

  return color && HEX_COLOR_PATTERN.test(color) ? color : fallback;
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
      primaryColor: readHexColor(
        url.searchParams.get("primary"),
        DEFAULT_PRIMARY_COLOR,
      ),
    },
    readCssScope(url.searchParams.get("scope")),
  );

  return new Response(css, {
    headers: {
      "Cache-Control": `public, s-maxage=${CACHE_REVALIDATE_SECONDS.siteSettings}, stale-while-revalidate=${CACHE_REVALIDATE_SECONDS.siteSettings}`,
      "Content-Type": "text/css; charset=utf-8",
    },
  });
}
