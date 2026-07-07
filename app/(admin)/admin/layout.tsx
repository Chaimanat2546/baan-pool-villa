import type { Metadata } from "next";
import { cookies } from "next/headers";

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
  const [{ settings }, cookieStore] = await Promise.all([
    getSiteSettings(),
    cookies(),
  ]);
  const initialDesktopNavCollapsed =
    cookieStore.get("admin-sidebar-collapsed")?.value === "true";

  return (
    <SiteThemeProvider settings={settings}>
      <AdminShell
        initialDesktopNavCollapsed={initialDesktopNavCollapsed}
        settings={settings}
      >
        {children}
      </AdminShell>
    </SiteThemeProvider>
  );
}
