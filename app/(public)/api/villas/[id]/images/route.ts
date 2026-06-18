import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  fetchAllowedVillaImageDownload,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "@/lib/villas/image-download";
import {
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
  parsePublicImageProxyTransformRequest,
} from "@/lib/public-image-proxy-server";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestUrl = new URL(request.url);
  const isDownloadRequest = requestUrl.searchParams.get("download") === "1";
  const rateLimitResponse = limitPublicApiRequest(
    request,
    isDownloadRequest ? "publicDownload" : "publicDetail",
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  try {
    parseVillaId(id);
    const images = await fetchVillaImages(id);

    if (requestUrl.searchParams.has("url")) {
      if (isDownloadRequest) {
        return downloadVillaImage(requestUrl, id, images);
      }

      return proxyVillaImage(request, requestUrl, images);
    }

    return Response.json(
      { images },
      {
        headers: {
          "Cache-Control": CACHE_HEADERS.villaImages,
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid villa id") {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }

    return publicApiErrorResponse("Unable to load villa images", error);
  }
}

async function proxyVillaImage(
  request: Request,
  requestUrl: URL,
  images: Awaited<ReturnType<typeof fetchVillaImages>>,
) {
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const transformRequest = parsePublicImageProxyTransformRequest(request);

  if (!transformRequest.valid) {
    return Response.json({ error: "Invalid image transform" }, { status: 400 });
  }

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
}

async function downloadVillaImage(
  requestUrl: URL,
  villaId: string,
  images: Awaited<ReturnType<typeof fetchVillaImages>>,
) {
  const targetUrl = normalizeDownloadImageUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const matchedImage = images.find((image) => image.imageUrl === targetUrl) ?? null;

  if (!isAllowedVillaImageUrl(targetUrl, images)) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, IMAGE_DOWNLOAD_TIMEOUT_MS);
  let upstreamResponse: Response | null;

  try {
    upstreamResponse = await fetchAllowedVillaImageDownload(targetUrl, images, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = upstreamResponse?.headers.get("Content-Type") ?? "";

  if (
    !upstreamResponse?.ok ||
    !upstreamResponse.body ||
    !contentType.trim().toLowerCase().startsWith("image/")
  ) {
    return Response.json({ error: "Unable to download image" }, { status: 502 });
  }

  const filename = buildImageDownloadFilename({
    contentType,
    imageName: requestUrl.searchParams.get("name") ?? matchedImage?.imageName,
    sourceUrl: targetUrl,
    villaId,
    zoneKey: requestUrl.searchParams.get("zone") ?? matchedImage?.zone,
  });

  return new Response(upstreamResponse.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": createAttachmentDisposition(filename),
      "Content-Type": contentType,
    },
  });
}
