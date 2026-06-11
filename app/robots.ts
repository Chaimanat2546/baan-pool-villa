import type { MetadataRoute } from "next";

import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    host: getSiteUrl().origin,
    rules: [
      {
        allow: "/",
        disallow: ["/api/", "/admin/","/search/"],
        userAgent: "*",
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
