import { CACHE_HEADERS } from "@/lib/cache-policy";
import { fetchHouseListings } from "@/lib/villas/server";

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
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load houses",
      },
      { status: 502 },
    );
  }
}
