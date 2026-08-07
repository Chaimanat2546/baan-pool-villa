import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildVillaCoverImageDownloadResponse,
  buildVillaImageDownloadResponse,
  isInvalidVillaIdError,
} from "@/lib/villas/public-image-route";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicDownload");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  try {
    if (new URL(request.url).searchParams.has("cover")) {
      return await buildVillaCoverImageDownloadResponse(request, id);
    }

    return await buildVillaImageDownloadResponse(request, id);
  } catch (error) {
    if (isInvalidVillaIdError(error)) {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    return publicApiErrorResponse("Unable to download image", error);
  }
}
