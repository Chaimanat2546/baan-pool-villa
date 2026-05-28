import type { Metadata } from "next";
import { Prompt } from "next/font/google";

import {
  buildPageMetadata,
  defaultDescription,
  defaultTitle,
  getSiteUrl,
  siteName,
} from "@/lib/seo";

import "./globals.css";

const prompt = Prompt({
  display: "swap",
  preload: false,
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  ...buildPageMetadata({
    canonicalPath: "/",
    description: defaultDescription,
    title: defaultTitle,
  }),
  applicationName: siteName,
  metadataBase: getSiteUrl(),
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f7f4] text-[#063f35] ">
        {children}
      </body>
    </html>
  );
}
