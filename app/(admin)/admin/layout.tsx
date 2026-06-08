import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/layout/admin-shell";
import { SiteThemeProvider } from "@/components/layout/site-theme-provider";
import { getSiteSettings } from "@/lib/site-settings/server";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings } = await getSiteSettings();

  return (
    <SiteThemeProvider settings={settings}>
      <AdminShell settings={settings}>{children}</AdminShell>
    </SiteThemeProvider>
  );
}
