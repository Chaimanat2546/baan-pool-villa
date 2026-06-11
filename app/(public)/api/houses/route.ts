import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchHouseListings } from "@/lib/villas/server";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const items = await fetchHouseListings();
    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": CACHE_HEADERS.villaListings,
        },
      },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load houses", error);
  }
}
