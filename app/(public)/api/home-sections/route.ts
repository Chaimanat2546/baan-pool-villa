import {
  getResolvedHomeSections,
  type HomeSectionsSource,
} from "@/lib/home-sections/server";
import { CACHE_HEADERS } from "@/lib/cache-policy";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import { fetchHouseListings } from "@/lib/villas/server";

function jsonHomeSections(
  sections: ResolvedHomeSection[],
  source: HomeSectionsSource,
) {
  return Response.json(
    { sections, source },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.homeSections,
      },
    },
  );
}

export async function GET() {
  const villas = await fetchHouseListings();
  const { sections, source } = await getResolvedHomeSections(villas);

  return jsonHomeSections(sections, source);
}
