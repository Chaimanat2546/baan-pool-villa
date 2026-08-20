import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { isAllowedTikTokCdnImageUrl } from "@/lib/public-image-proxy";
import { buildAllowedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await buildAllowedPublicImageProxyResponse(
      request,
      isAllowedTikTokCdnImageUrl,
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
