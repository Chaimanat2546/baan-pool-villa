import { CACHE_HEADERS } from "@/lib/cache-policy";
import {
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
  parsePublicImageProxyTransformRequest,
} from "@/lib/public-image-proxy-server";
import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  fetchAllowedVillaImageDownload,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "@/lib/villas/image-download";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";

const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;

type VillaImages = Awaited<ReturnType<typeof fetchVillaImages>>;

export function isInvalidVillaIdError(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid villa id";
}

export async function buildVillaImagesRouteResponse(request: Request, id: string) {
  parseVillaId(id);

  const requestUrl = new URL(request.url);
  const images = await fetchVillaImages(id);

  if (requestUrl.searchParams.has("url")) {
    return requestUrl.searchParams.get("download") === "1"
      ? downloadVillaImage(requestUrl, id, images)
      : proxyVillaImage(request, requestUrl, images);
  }

  return Response.json(
    { images },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.villaImages,
      },
    },
  );
}

export async function buildVillaImageProxyResponse(request: Request, id: string) {
  parseVillaId(id);

  const requestUrl = new URL(request.url);
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const transformRequest = parsePublicImageProxyTransformRequest(request);

  if (!transformRequest.valid) {
    return Response.json({ error: "Invalid image transform" }, { status: 400 });
  }

  const images = await fetchVillaImages(id);

  return proxyVillaImage(request, requestUrl, images);
}

export async function buildVillaImageDownloadResponse(request: Request, id: string) {
  parseVillaId(id);

  const requestUrl = new URL(request.url);
  const targetUrl = normalizeDownloadImageUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const images = await fetchVillaImages(id);

  return downloadVillaImage(requestUrl, id, images);
}

async function proxyVillaImage(
  request: Request,
  requestUrl: URL,
  images: VillaImages,
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
  images: VillaImages,
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
