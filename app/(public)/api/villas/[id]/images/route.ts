import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildVillaImagesRouteResponse,
  classifyVillaImagesRequest,
  isInvalidVillaIdError,
  villaImagesNotFoundResponse,
} from "@/lib/villas/public-image-route";
import { parseVillaId } from "@/lib/villas/images";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    parseVillaId(id);

    const decision = classifyVillaImagesRequest(request);

    if (!decision.ok) {
      return villaImagesNotFoundResponse();
    }

    const rateLimitResponse = limitPublicApiRequest(request, decision.policy);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return await buildVillaImagesRouteResponse(request, id, decision.mode);
  } catch (error) {
    if (isInvalidVillaIdError(error)) {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    return publicApiErrorResponse("Unable to load villa images", error);
  }
}
