import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildVillaImageProxyResponse,
  isInvalidVillaIdError,
} from "@/lib/villas/public-image-route";

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
    return await buildVillaImageProxyResponse(request, id);
  } catch (error) {
    if (isInvalidVillaIdError(error)) {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    return publicApiErrorResponse("Unable to load image", error);
  }
}
