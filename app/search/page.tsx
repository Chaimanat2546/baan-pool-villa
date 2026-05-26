import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchPage } from "@/components/villas/search-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/search",
  description:
    "ค้นหาพูลวิลล่าพัทยาตามทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก และบ้านพักใกล้ทะเลไม่เกิน 2 กม.",
  title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
