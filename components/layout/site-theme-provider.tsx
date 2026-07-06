import { buildSiteThemeStylesheetHref } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";

interface SiteThemeProviderProps {
  children: React.ReactNode;
  settings: SiteSettings;
}

export function SiteThemeProvider({
  children,
  settings,
}: SiteThemeProviderProps) {
  const themeHref = buildSiteThemeStylesheetHref({
    accentColor: settings.accentColor,
    bankHighlightColor: settings.bankHighlightColor,
    bankAccountHighlightColor: settings.bankAccountHighlightColor,
    bankNameHighlightColor: settings.bankNameHighlightColor,
    bankNumberHighlightColor: settings.bankNumberHighlightColor,
    footerLinkColor: settings.footerLinkColor,
    footerLinkHoverColor: settings.footerLinkHoverColor,
    headerLinkColor: settings.headerLinkColor,
    headerLinkHoverColor: settings.headerLinkHoverColor,
    primaryColor: settings.primaryColor,
  });

  return (
    <div className="site-theme min-h-full">
      <link href={themeHref} rel="stylesheet" />
      {children}
    </div>
  );
}
