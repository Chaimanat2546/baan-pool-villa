import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "@/lib/villas/image-download";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;

/**
 * Handle GET requests to download a villa image identified by the route `id`.
 *
 * This endpoint expects a query parameter `url` (the image URL to download). It validates the `id` format, normalizes and validates the target image URL, checks authorization against the villa's images (and optionally villa detail), downloads the image from the upstream URL, and returns the upstream image stream with appropriate download headers.
 *
 * @param request - Incoming Request whose URL search params must include `url`; optional search params: `name` (override filename) and `zone` (zone key for filename).
 * @param context - Route context containing `params` that resolve to an object with `id` (the villa id).
 * @returns A Response containing either:
 *  - a JSON error with status 400 when `id` or `url` is invalid,
 *  - a JSON error with status 404 when the image is not allowed/found,
 *  - a JSON error with status 502 when the upstream image cannot be retrieved or is invalid,
 *  - or a streamed image Response with `Cache-Control: no-store`, `Content-Disposition` set for attachment, and `Content-Type` matching the upstream image.
 */
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
    parseVillaId(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid villa id") {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }
    throw error;
  }

  const requestUrl = new URL(request.url);
  const targetUrl = normalizeDownloadImageUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const images = await fetchVillaImages(id);
    const matchedImage = images.find((image) => image.imageUrl === targetUrl) ?? null;

    if (!isAllowedVillaImageUrl(targetUrl, images)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, IMAGE_DOWNLOAD_TIMEOUT_MS);
    let upstreamResponse: Response;

    try {
      upstreamResponse = await fetch(targetUrl, {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = upstreamResponse.headers.get("Content-Type") ?? "";

    if (
      !upstreamResponse.ok ||
      !upstreamResponse.body ||
      !contentType.trim().toLowerCase().startsWith("image/")
    ) {
      return Response.json({ error: "Unable to download image" }, { status: 502 });
    }

    const filename = buildImageDownloadFilename({
      contentType,
      imageName: requestUrl.searchParams.get("name") ?? matchedImage?.imageName,
      sourceUrl: targetUrl,
      villaId: id,
      zoneKey: requestUrl.searchParams.get("zone") ?? matchedImage?.zone,
    });

    return new Response(upstreamResponse.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": createAttachmentDisposition(filename),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return publicApiErrorResponse("Unable to download image", error);
  }
}
