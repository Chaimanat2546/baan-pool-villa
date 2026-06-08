import type { Metadata } from "next";

import { GuideListPage } from "@/components/guides/guide-list-page";
import { getPublishedGuides } from "@/lib/guides/server";
import { buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";

export const revalidate = 43200;

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    canonicalPath: "/guides",
    section: "guides",
    settings,
  });
}

export default async function GuidesPageRoute() {
  const guides = await getPublishedGuides();

  return <GuideListPage guides={guides} />;
}
