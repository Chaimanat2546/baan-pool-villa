import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchVillaDetail } from "@/lib/villas/server";

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
    const payload = await fetchVillaDetail(id);

    if (!payload) {
      return Response.json({ error: "Villa not found" }, { status: 404 });
    }

    return Response.json(payload, {
      headers: {
        "Cache-Control": CACHE_HEADERS.villaDetail,
      },
    });
  } catch (error) {
    return publicApiErrorResponse("Unable to load villa", error);
  }
}
