import type { Metadata } from "next";
import { Prompt } from "next/font/google";

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
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f7f4] text-[#063f35]">
        {children}
      </body>
    </html>
  );
}
