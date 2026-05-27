import { fetchHouseListings } from "@/lib/villas/server";

export async function GET() {
  try {
    const items = await fetchHouseListings();
    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
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
