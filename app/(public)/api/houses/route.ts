import { CACHE_HEADERS } from "@/lib/cache-policy";
import { fetchHouseListings } from "@/lib/villas/server";
import { publicApiErrorResponse } from "@/lib/api/errors";

export async function GET() {
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
