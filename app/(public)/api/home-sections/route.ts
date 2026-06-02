import {
  getResolvedHomeSections,
  type HomeSectionsSource,
} from "@/lib/home-sections/server";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import { fetchHouseListings } from "@/lib/villas/server";

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

function jsonHomeSections(
  sections: ResolvedHomeSection[],
  source: HomeSectionsSource,
) {
  return Response.json(
    { sections, source },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    },
  );
}

export async function GET() {
  const villas = await fetchHouseListings();
  const { sections, source } = await getResolvedHomeSections(villas);

  return jsonHomeSections(sections, source);
}
