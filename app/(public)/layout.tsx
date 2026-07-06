import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteThemeProvider } from "@/components/layout/site-theme-provider";
import { VillaCardStyleProvider } from "@/components/villas/listing/villa-card-style-context";
import { getSiteSettings } from "@/lib/site-settings/server";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings } = await getSiteSettings();

  return (
    <SiteThemeProvider settings={settings}>
      <div className="min-h-full pb-24 md:pb-0">
        <SiteHeader settings={settings} />
        <VillaCardStyleProvider value={settings.villaCardStyle}>
          {children}
        </VillaCardStyleProvider>
        <SiteFooter settings={settings} />
        <MobileBottomNav settings={settings} />
      </div>
    </SiteThemeProvider>
  );
}
