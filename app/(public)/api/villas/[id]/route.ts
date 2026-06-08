import { CACHE_HEADERS } from "@/lib/cache-policy";
import { fetchVillaDetail } from "@/lib/villas/server";
import { publicApiErrorResponse } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
