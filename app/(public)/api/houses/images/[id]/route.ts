import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";
import { getListingById } from "@/lib/villas/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await params;
    const listing = await getListingById(id);

    return await buildResolvedPublicImageProxyResponse(
      request,
      listing?.coverImage ?? null,
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
