import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildVillaImagesRouteResponse,
  isInvalidVillaIdError,
} from "@/lib/villas/public-image-route";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestUrl = new URL(request.url);
  const isDownloadRequest = requestUrl.searchParams.get("download") === "1";
  const rateLimitResponse = limitPublicApiRequest(
    request,
    isDownloadRequest ? "publicDownload" : "publicDetail",
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;
    return await buildVillaImagesRouteResponse(request, id);
  } catch (error) {
    if (isInvalidVillaIdError(error)) {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    return publicApiErrorResponse("Unable to load villa images", error);
  }
}
