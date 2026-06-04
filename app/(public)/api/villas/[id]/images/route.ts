import { CACHE_HEADERS } from "@/lib/cache-policy";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    parseVillaId(id);
    const images = await fetchVillaImages(id);
    return Response.json(
      { images },
      {
        headers: {
          "Cache-Control": CACHE_HEADERS.villaImages,
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid villa id") {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    console.error("Unable to load villa images", error);

    return Response.json(
      {
        error: "Unable to load villa images",
      },
      { status: 502 },
    );
  }
}
