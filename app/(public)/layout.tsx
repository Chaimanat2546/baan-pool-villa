import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteThemeProvider } from "@/components/layout/site-theme-provider";
import { getSiteSettings } from "@/lib/site-settings/server";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings } = await getSiteSettings();

  return (
    <SiteThemeProvider settings={settings}>
      <div className="min-h-full pb-24 lg:pb-0">
        <SiteHeader settings={settings} />
        {children}
        <SiteFooter settings={settings} />
        <MobileBottomNav settings={settings} />
      </div>
    </SiteThemeProvider>
  );
}
