import type { PublicRateLimitPolicy } from "@/lib/api/rate-limit";
import { CACHE_HEADERS } from "@/lib/cache-policy";
import {
  cancelledPublicImageProxyResponse,
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
  parsePublicImageProxyTransformRequest,
} from "@/lib/public-image-proxy-server";
import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "@/lib/villas/image-download";
import {
  fetchVillaImageById,
  fetchVillaImages,
  parseVillaId,
  resolveDisplayImages,
} from "@/lib/villas/images";
import { toPublicVillaImages } from "@/lib/villas/public-dto";
import { getListingById } from "@/lib/villas/server";
import type { VillaImage } from "@/lib/villas/types";

const DISPLAY_QUERY_KEYS = new Set(["imageId", "url", "w", "q"]);
const DOWNLOAD_QUERY_KEYS = new Set([
  "download",
  "imageId",
  "url",
  "name",
  "zone",
]);

type VillaImages = Awaited<ReturnType<typeof fetchVillaImages>>;
export type VillaImagesRequestMode = "card" | "display" | "download";

export type VillaImagesRequestDecision =
  | {
      ok: true;
      mode: VillaImagesRequestMode;
      policy: PublicRateLimitPolicy;
    }
  | { ok: false };

export function isInvalidVillaIdError(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid villa id";
}

export function classifyVillaImagesRequest(
  request: Request,
): VillaImagesRequestDecision {
  const searchParams = new URL(request.url).searchParams;
  const entries = Array.from(searchParams.entries());
  const seenKeys = new Set<string>();

  for (const [key] of entries) {
    if (seenKeys.has(key)) {
      return { ok: false };
    }

    seenKeys.add(key);
  }

  if (
    entries.length === 1 &&
    entries[0][0] === "view" &&
    entries[0][1] === "card"
  ) {
    return {
      ok: true,
      mode: "card",
      policy: "publicImageManifest",
    };
  }

  const hasImageId = searchParams.has("imageId");
  const hasUrl = searchParams.has("url");

  if (hasImageId === hasUrl) {
    return { ok: false };
  }

  if (searchParams.has("download")) {
    if (
      searchParams.get("download") !== "1" ||
      entries.some(([key]) => !DOWNLOAD_QUERY_KEYS.has(key))
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      mode: "download",
      policy: "publicDownload",
    };
  }

  if (entries.some(([key]) => !DISPLAY_QUERY_KEYS.has(key))) {
    return { ok: false };
  }

  return {
    ok: true,
    mode: "display",
    policy: "publicImageDelivery",
  };
}

export function villaImagesNotFoundResponse(): Response {
  return Response.json(
    { error: "Not found" },
    {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function buildVillaImagesRouteResponse(
  request: Request,
  id: string,
  mode: VillaImagesRequestMode,
) {
  parseVillaId(id);

  const requestUrl = new URL(request.url);

  if (mode === "card") {
    const images = await resolveDisplayImages(id);

    return Response.json(
      { images: toPublicVillaImages(id, images) },
      {
        headers: {
          "Cache-Control": CACHE_HEADERS.villaCardImages,
        },
      },
    );
  }

  if (mode === "display") {
    if (requestUrl.searchParams.has("imageId")) {
      const image = await fetchVillaImageById(
        id,
        requestUrl.searchParams.get("imageId"),
      );

      if (!image) {
        return Response.json({ error: "Image not found" }, { status: 404 });
      }

      return proxyVillaImage(request, requestUrl, [image], image.imageUrl);
    }

    const images = await fetchVillaImages(id);
    return proxyVillaImage(request, requestUrl, images);
  }

  if (mode === "download") {
    if (requestUrl.searchParams.has("imageId")) {
      const image = await fetchVillaImageById(
        id,
        requestUrl.searchParams.get("imageId"),
      );

      if (!image) {
        return Response.json({ error: "Image not found" }, { status: 404 });
      }

      return downloadVillaImage(requestUrl, id, [image], image.imageUrl);
    }

    const images = await fetchVillaImages(id);
    return downloadVillaImage(requestUrl, id, images);
  }

  const exhaustiveMode: never = mode;
  return exhaustiveMode;
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

export async function buildVillaCoverImageDownloadResponse(
  request: Request,
  id: string,
) {
  parseVillaId(id);

  const requestUrl = new URL(request.url);

  if (
    requestUrl.searchParams.size !== 1 ||
    requestUrl.searchParams.get("cover") !== "1"
  ) {
    return Response.json({ error: "Invalid cover image download" }, { status: 400 });
  }

  const coverImageUrl = (await getListingById(id))?.coverImage ?? null;
  const imageUrl = normalizeDownloadImageUrl(coverImageUrl);

  if (!imageUrl) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const coverImage: VillaImage = {
    caption: null,
    id: 0,
    imageName: new URL(imageUrl).pathname.split("/").pop() || null,
    imageUrl,
    isCover: true,
    zone: "cover",
  };

  return downloadVillaImage(requestUrl, id, [coverImage], imageUrl);
}

async function proxyVillaImage(
  request: Request,
  requestUrl: URL,
  images: VillaImages,
  sourceUrl?: string,
) {
  const targetUrl = sourceUrl
    ? normalizePublicImageProxyUrl(sourceUrl)
    : normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

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
    request.signal,
  );

  if (!imageResponse) {
    const cancelledResponse = cancelledPublicImageProxyResponse(request);

    if (cancelledResponse) {
      return cancelledResponse;
    }

    return Response.json({ error: "Unable to load image" }, { status: 502 });
  }

  return imageResponse;
}

async function downloadVillaImage(
  requestUrl: URL,
  villaId: string,
  images: VillaImages,
  sourceUrl?: string,
) {
  const targetUrl = sourceUrl
    ? normalizeDownloadImageUrl(sourceUrl)
    : normalizeDownloadImageUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const matchedImage = images.find((image) => image.imageUrl === targetUrl) ?? null;

  if (!isAllowedVillaImageUrl(targetUrl, images)) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const upstreamResponse = await fetchPublicImageProxyResponse(targetUrl, {
    quality: 90,
    width: 1920,
  });

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
