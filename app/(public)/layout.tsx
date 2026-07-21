import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteThemeProvider } from "@/components/layout/site-theme-provider";
import { VillaCardStyleProvider } from "@/components/villas/listing/villa-card-style-context";
import { getSiteSettings } from "@/lib/site-settings/server";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ settings }, { settings: contactSettings }, styles] = await Promise.all([
    getSiteSettings(),
    getSiteContactSettings(),
    getSiteWebStyles(),
  ]);

  return (
    <SiteThemeProvider settings={settings}>
      <div className="min-h-full pb-32 md:pb-0">
        <SiteHeader contactSettings={contactSettings} desktopHeaderVariant={styles.header.variant} settings={settings} />
        <VillaCardStyleProvider value={styles.houseCard.variant}>
          {children}
        </VillaCardStyleProvider>
        <SiteFooter contactSettings={contactSettings} settings={settings} />
        <MobileBottomNav settings={contactSettings} />
      </div>
    </SiteThemeProvider>
  );
}
