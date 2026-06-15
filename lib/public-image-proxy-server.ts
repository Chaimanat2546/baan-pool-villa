import "server-only";

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
  const cloudflareImageOptions = toCloudflareImageOptions(transform);
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
