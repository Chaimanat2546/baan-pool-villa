import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
  type HomeSectionsSource,
} from "@/lib/home-sections/server";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
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

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const planResult = await getHomeSectionListingPlan().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const villas = await fetchHouseListings();
  const { sections, source } =
    planResult.status === "fulfilled"
      ? await getResolvedHomeSections(
          villas,
          planResult.value.configs,
          planResult.value.layout.source === "fallback",
        )
      : await getResolvedHomeSections(villas);

  if (planResult.status === "rejected") {
    console.error(
      "Unable to load home section listing plan",
      planResult.reason,
    );
  }

  return jsonHomeSections(sections, source);
}
