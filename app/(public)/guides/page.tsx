import type { Metadata } from "next";

import { GuideListPage } from "@/components/guides/guide-list-page";
import { getPublishedGuides } from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
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
  let guides: GuidePost[] = [];

  try {
    guides = await getPublishedGuides();
  } catch (error) {
    console.error("Unable to prerender guide list page", error);
  }

  return <GuideListPage guides={guides} />;
}
