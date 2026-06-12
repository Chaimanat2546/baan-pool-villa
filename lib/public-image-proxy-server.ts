import "server-only";

import { normalizeDownloadImageUrl } from "@/lib/villas/image-download";
import { PUBLIC_IMAGE_PROXY_CACHE_CONTROL } from "@/lib/public-image-proxy";

const IMAGE_PROXY_TIMEOUT_MS = 10_000;
const MAX_IMAGE_PROXY_REDIRECTS = 2;

export function normalizePublicImageProxyUrl(value: string | null): string | null {
  return normalizeDownloadImageUrl(value);
}

export async function fetchPublicImageProxyResponse(
  targetUrl: string,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, IMAGE_PROXY_TIMEOUT_MS);
  let upstreamResponse: Response | null = null;
  let currentUrl = targetUrl;

  try {
    for (let redirectCount = 0; redirectCount <= MAX_IMAGE_PROXY_REDIRECTS; redirectCount += 1) {
      upstreamResponse = await fetch(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });

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

  return upstreamResponse ? toPublicImageProxyResponse(upstreamResponse) : null;
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

  const redirectUrl = normalizePublicImageProxyUrl(
    new URL(location, originalTargetUrl).toString(),
  );

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
