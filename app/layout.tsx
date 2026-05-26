import type { Metadata } from "next";
import { Prompt } from "next/font/google";

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import "./globals.css";

const prompt = Prompt({
  display: "swap",
  preload: false,
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Baan Pool Villa",
  description: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${prompt.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f4f7f4] pb-20 text-[#063f35] lg:pb-0">
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
