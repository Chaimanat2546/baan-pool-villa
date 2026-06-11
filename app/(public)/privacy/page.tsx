import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getLegalPageBySlug } from "@/lib/legal-pages/server";
import { buildLegalPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

export async function generateMetadata(): Promise<Metadata> {
  const [page, siteSettingsResult] = await Promise.all([
    getLegalPageBySlug("privacy"),
    getSiteSettings(),
  ]);

  return buildLegalPageMetadata({
    page,
    settings: siteSettingsResult.settings,
  });
}

export default async function PrivacyRoute() {
  const [page, siteSettingsResult] = await Promise.all([
    getLegalPageBySlug("privacy"),
    getSiteSettings(),
  ]);

  return <LegalPage page={page} settings={siteSettingsResult.settings} />;
}
