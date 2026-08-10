import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getHomepageCustomerReviewImageSource } from "@/lib/customer-reviews/server";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

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

    return await buildResolvedPublicImageProxyResponse(
      request,
      await getHomepageCustomerReviewImageSource(id),
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
