import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchPage } from "@/components/villas/search/page";
import { buildPageMetadata, searchDescription } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  canonicalPath: "/search",
  description: searchDescription,
  title: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
