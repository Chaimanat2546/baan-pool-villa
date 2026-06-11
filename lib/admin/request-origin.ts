import "server-only";

const ADMIN_ORIGIN_GUARDED_METHODS = new Set(["POST", "PUT", "DELETE"]);
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function getConfiguredSiteOrigin(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    return null;
  }

  const parsedUrl = parseUrl(siteUrl);

  return parsedUrl && isHttpUrl(parsedUrl) ? parsedUrl.origin : null;
}

function isLocalhostOrigin(url: URL): boolean {
  return isHttpUrl(url) && LOCALHOST_NAMES.has(url.hostname);
}

function isOriginGuardedMethod(method: string): boolean {
  return ADMIN_ORIGIN_GUARDED_METHODS.has(method.toUpperCase());
}

export function isAllowedAdminRequestOrigin(request: Request): boolean {
  if (!isOriginGuardedMethod(request.method)) {
    return true;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const originUrl = parseUrl(origin);
  const requestUrl = parseUrl(request.url);

  if (!originUrl || !requestUrl || !isHttpUrl(originUrl)) {
    return false;
  }

  const siteOrigin = getConfiguredSiteOrigin();

  return (
    originUrl.host === requestUrl.host ||
    originUrl.origin === siteOrigin ||
    (process.env.NODE_ENV === "development" && isLocalhostOrigin(originUrl))
  );
}
