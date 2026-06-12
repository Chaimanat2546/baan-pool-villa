import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
} from "@/lib/public-image-proxy-server";
import { fetchHouseListings } from "@/lib/villas/server";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const requestUrl = new URL(request.url);
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const listings = await fetchHouseListings();
    const isAllowedCoverImage = listings.some(
      (listing) => listing.coverImage === targetUrl,
    );

    if (!isAllowedCoverImage) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const imageResponse = await fetchPublicImageProxyResponse(targetUrl);

    if (!imageResponse) {
      return Response.json({ error: "Unable to load image" }, { status: 502 });
    }

    return imageResponse;
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
