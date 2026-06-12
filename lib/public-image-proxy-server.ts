import "server-only";

import { normalizeDownloadImageUrl } from "@/lib/villas/image-download";
import { PUBLIC_IMAGE_PROXY_CACHE_CONTROL } from "@/lib/public-image-proxy";

const IMAGE_PROXY_TIMEOUT_MS = 10_000;

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
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(targetUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  return toPublicImageProxyResponse(upstreamResponse);
}

async function cancelUpstreamResponseBody(upstreamResponse: Response) {
  await upstreamResponse.body?.cancel().catch(() => undefined);
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
