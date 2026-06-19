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
    primaryColor: settings.primaryColor,
  });

  return (
    <div className="site-theme min-h-full">
      <link href={themeHref} rel="stylesheet" />
      {children}
    </div>
  );
}
