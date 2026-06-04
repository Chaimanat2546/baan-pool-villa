import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";

interface SiteThemeProviderProps {
  children: React.ReactNode;
  settings: SiteSettings;
}

export function SiteThemeProvider({
  children,
  settings,
}: SiteThemeProviderProps) {
  return (
    <div
      className="min-h-full"
      style={buildSiteThemeStyle({
        accentColor: settings.accentColor,
        primaryColor: settings.primaryColor,
      })}
    >
      {children}
    </div>
  );
}
