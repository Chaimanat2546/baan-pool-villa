import { isAllowedVillaImageUrl } from "@/lib/villas/image-download";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
  parsePublicImageProxyTransformRequest,
} from "@/lib/public-image-proxy-server";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

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
    parseVillaId(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid villa id") {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }
    throw error;
  }

  const requestUrl = new URL(request.url);
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const transformRequest = parsePublicImageProxyTransformRequest(request);

  if (!transformRequest.valid) {
    return Response.json({ error: "Invalid image transform" }, { status: 400 });
  }

  try {
    const images = await fetchVillaImages(id);

    if (!isAllowedVillaImageUrl(targetUrl, images)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const imageResponse = await fetchPublicImageProxyResponse(
      targetUrl,
      transformRequest.params,
    );

    if (!imageResponse) {
      return Response.json({ error: "Unable to load image" }, { status: 502 });
    }

    return imageResponse;
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
