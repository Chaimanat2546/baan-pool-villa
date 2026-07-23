import "server-only";

import {
  buildAwsImageUrl,
  getAwsImageLoaderOrigin,
} from "@/lib/aws-image-url";
import { normalizeDownloadImageUrl } from "@/lib/villas/image-download";
import {
  PUBLIC_IMAGE_PROXY_CACHE_CONTROL,
  parsePublicImageTransformParams,
  type PublicImageTransformParams,
} from "@/lib/public-image-proxy";

const IMAGE_PROXY_TIMEOUT_MS = 10_000;
const MAX_IMAGE_PROXY_REDIRECTS = 2;

interface CloudflareImageOptions {
  fit: "scale-down";
  format?: "avif" | "webp";
  quality?: number;
  width?: number;
}

interface CloudflareFetchInit extends RequestInit {
  cf?: {
    image: CloudflareImageOptions;
  };
}

interface PublicImageProxyTransformParams extends PublicImageTransformParams {
  format?: "avif" | "webp";
}

export type PublicImageProxyTransformRequest =
  | { params: PublicImageProxyTransformParams; valid: true }
  | { params: null; valid: false };

type PublicImageProxyAuthorizer = (targetUrl: string) => boolean | Promise<boolean>;

export function normalizePublicImageProxyUrl(value: string | null): string | null {
  return normalizeDownloadImageUrl(value);
}

function getPreferredImageFormat(acceptHeader: string | null): "avif" | "webp" | undefined {
  const accept = acceptHeader?.toLowerCase() ?? "";

  if (accept.includes("image/avif")) {
    return "avif";
  }

  if (accept.includes("image/webp")) {
    return "webp";
  }

  return undefined;
}

export function parsePublicImageProxyTransformRequest(
  request: Request,
): PublicImageProxyTransformRequest {
  const url = new URL(request.url);
  const parseResult = parsePublicImageTransformParams(url.searchParams);

  if (!parseResult.valid) {
    return parseResult;
  }

  return {
    params: {
      ...parseResult.params,
      format: getPreferredImageFormat(request.headers.get("Accept")),
    },
    valid: true,
  };
}

function toCloudflareImageOptions(
  transform: PublicImageProxyTransformParams,
): CloudflareImageOptions | null {
  if (!transform.width && !transform.quality) {
    return null;
  }

  const image: CloudflareImageOptions = {
    fit: "scale-down",
  };

  if (transform.width) {
    image.width = transform.width;
  }

  if (transform.quality) {
    image.quality = transform.quality;
  }

  if (transform.format) {
    image.format = transform.format;
  }

  return image;
}

export async function fetchPublicImageProxyResponse(
  targetUrl: string,
  transform: PublicImageProxyTransformParams = {},
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, IMAGE_PROXY_TIMEOUT_MS);
  let upstreamResponse: Response | null = null;
  let currentUrl = targetUrl;

  try {
    const loaderUrl = buildAwsImageUrl({
      quality: transform.quality ?? 75,
      src: targetUrl,
      width: transform.width ?? 1920,
    });

    if (new URL(loaderUrl).origin === getAwsImageLoaderOrigin()) {
      currentUrl = loaderUrl;
    }
  } catch {
    // Non-loader image sources continue through the validated direct proxy.
  }

  const cloudflareImageOptions =
    currentUrl === targetUrl ? toCloudflareImageOptions(transform) : null;
  const fetchInit: CloudflareFetchInit = {
    cache: "no-store",
    redirect: "manual",
    signal: controller.signal,
  };

  if (cloudflareImageOptions) {
    fetchInit.cf = {
      image: cloudflareImageOptions,
    };
  }

  try {
    for (let redirectCount = 0; redirectCount <= MAX_IMAGE_PROXY_REDIRECTS; redirectCount += 1) {
      upstreamResponse = await fetch(currentUrl, fetchInit);

      if (
        upstreamResponse.status === 429 ||
        upstreamResponse.status >= 500
      ) {
        await cancelUpstreamResponseBody(upstreamResponse);
        upstreamResponse = await fetch(currentUrl, fetchInit);
      }

      const redirectUrl = getAllowedImageRedirectUrl(targetUrl, upstreamResponse);

      if (!redirectUrl) {
        break;
      }

      await cancelUpstreamResponseBody(upstreamResponse);
      currentUrl = redirectUrl;
      upstreamResponse = null;
    }
  } finally {
    clearTimeout(timeout);
  }

  return upstreamResponse
    ? toPublicImageProxyResponse(upstreamResponse, transform)
    : null;
}

export async function buildAllowedPublicImageProxyResponse(
  request: Request,
  isAllowedUrl: PublicImageProxyAuthorizer,
) {
  const requestUrl = new URL(request.url);
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const transformRequest = parsePublicImageProxyTransformRequest(request);

  if (!transformRequest.valid) {
    return Response.json({ error: "Invalid image transform" }, { status: 400 });
  }

  if (!(await isAllowedUrl(targetUrl))) {
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

export async function buildResolvedPublicImageProxyResponse(
  request: Request,
  sourceUrl: string | null,
) {
  const targetUrl = normalizePublicImageProxyUrl(sourceUrl);

  if (!targetUrl) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const transformRequest = parsePublicImageProxyTransformRequest(request);

  if (!transformRequest.valid) {
    return Response.json({ error: "Invalid image transform" }, { status: 400 });
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

async function cancelUpstreamResponseBody(upstreamResponse: Response) {
  await upstreamResponse.body?.cancel().catch(() => undefined);
}

function getAllowedImageRedirectUrl(
  originalTargetUrl: string,
  upstreamResponse: Response,
): string | null {
  if (upstreamResponse.status < 300 || upstreamResponse.status >= 400) {
    return null;
  }

  const location = upstreamResponse.headers.get("Location");

  if (!location) {
    return null;
  }

  let redirectUrl: string | null;

  try {
    redirectUrl = normalizePublicImageProxyUrl(
      new URL(location, originalTargetUrl).toString(),
    );
  } catch {
    return null;
  }

  if (!redirectUrl || !isSamePublicImageResource(originalTargetUrl, redirectUrl)) {
    return null;
  }

  return redirectUrl;
}

function normalizeRedirectHostname(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice("www.".length) : hostname;
}

function isSamePublicImageResource(leftValue: string, rightValue: string): boolean {
  const left = new URL(leftValue);
  const right = new URL(rightValue);

  return (
    left.protocol === right.protocol &&
    left.port === right.port &&
    normalizeRedirectHostname(left.hostname) === normalizeRedirectHostname(right.hostname) &&
    left.pathname === right.pathname &&
    left.search === right.search
  );
}

async function toPublicImageProxyResponse(
  upstreamResponse: Response,
  transform: PublicImageProxyTransformParams,
): Promise<Response | null> {
  const contentType = upstreamResponse.headers.get("Content-Type") ?? "";

  if (
    !upstreamResponse.ok ||
    (upstreamResponse.status >= 300 && upstreamResponse.status < 400) ||
    !upstreamResponse.body ||
    !contentType.trim().toLowerCase().startsWith("image/")
  ) {
    await cancelUpstreamResponseBody(upstreamResponse);

    return null;
  }

  const headers = new Headers();
  headers.set("Cache-Control", PUBLIC_IMAGE_PROXY_CACHE_CONTROL);
  headers.set("Content-Type", contentType);

  if (transform.width || transform.quality) {
    headers.set("Vary", "Accept");
  }

  const etag = upstreamResponse.headers.get("ETag");
  const lastModified = upstreamResponse.headers.get("Last-Modified");

  if (etag) {
    headers.set("ETag", etag);
  }

  if (lastModified) {
    headers.set("Last-Modified", lastModified);
  }

  return new Response(upstreamResponse.body, {
    headers,
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}
