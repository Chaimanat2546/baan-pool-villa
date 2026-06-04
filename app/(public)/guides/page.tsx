import type { Metadata } from "next";

import { GuideListPage } from "@/components/guides/guide-list-page";
import { buildPageMetadata } from "@/lib/seo";
import { getPublishedGuides } from "@/lib/guides/server";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    canonicalPath: "/guides",
    description:
      "บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว",
    title: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา",
  });
}

export default async function GuidesPageRoute() {
  const guides = await getPublishedGuides();

  return <GuideListPage guides={guides} />;
}
