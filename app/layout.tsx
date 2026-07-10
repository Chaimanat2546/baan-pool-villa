import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import Script from "next/script";

import { buildSiteSettingsGlobalMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

import "./globals.css";

const prompt = Prompt({
  display: "swap",
  preload: false,
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "700"],
});

// Render routes per request while preserving explicit tagged data caches.
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsGlobalMetadata(settings);
}

/**
 * Root layout component that provides the document <html> and <body> wrapper with global styles and font variable.
 *
 * @param children - The content to render inside the page body
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings } = await getSiteSettings();
  const googleTagManagerId = settings.googleTagManagerId;

  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f7f4] text-[#063f35]">
        {googleTagManagerId ? (
          <noscript>
            <iframe
              className="hidden"
              height={0}
              src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
              title="Google Tag Manager"
              width={0}
            />
          </noscript>
        ) : null}
        {children}
        {googleTagManagerId ? (
          <>
            <Script id="google-tag-manager-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });`}
            </Script>
            <Script
              id="google-tag-manager"
              src={`https://www.googletagmanager.com/gtm.js?id=${googleTagManagerId}`}
              strategy="afterInteractive"
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
