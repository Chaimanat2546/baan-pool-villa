import type { Metadata } from "next";

import { HomePage } from "@/components/villas/home/page";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildPageMetadata({
    canonicalPath: "/",
    description: settings.seo.description,
    image: settings.seo.ogImage.url,
    imageAlt: settings.seo.ogImage.alt,
    siteName: settings.seo.businessName,
    title: settings.seo.title,
  });
}

export default async function Page() {
  const { settings } = await getSiteSettings();
  const jsonLd = buildHomeJsonLd(settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomePage settings={settings} />
    </>
  );
}
