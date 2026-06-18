import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildAllowedPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
} from "@/lib/public-image-proxy-server";
import { fetchHouseListings } from "@/lib/villas/server";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await buildAllowedPublicImageProxyResponse(
      request,
      async (targetUrl) => {
        const listings = await fetchHouseListings();

        return listings.some(
          (listing) => normalizePublicImageProxyUrl(listing.coverImage) === targetUrl,
        );
      },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
