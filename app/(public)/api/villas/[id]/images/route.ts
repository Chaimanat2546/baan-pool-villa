import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicDetail");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

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

    return publicApiErrorResponse("Unable to load villa images", error);
  }
}
