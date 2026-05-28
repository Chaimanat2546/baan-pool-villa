import type { Metadata } from "next";

import { HomePage } from "@/components/villas/home/page";
import { serializeJsonLd } from "@/lib/json-ld";
import { absoluteUrl, buildPageMetadata, defaultDescription, defaultTitle, siteName } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/",
  description: defaultDescription,
  title: defaultTitle,
});

export default async function Page() {
  const { settings } = await getSiteSettings();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: siteName,
    description: defaultDescription,
    image: absoluteUrl("/images/BPV-66_Cover-Web.jpg"),
    url: absoluteUrl("/"),
    areaServed: ["พัทยา", "จอมเทียน", "บางแสน", "หัวหิน"],
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "สระว่ายน้ำส่วนตัว" },
      { "@type": "LocationFeatureSpecification", name: "บ้านพักสำหรับกลุ่ม" },
      { "@type": "LocationFeatureSpecification", name: "บ้านพักใกล้ทะเล" },
    ],
  };

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
