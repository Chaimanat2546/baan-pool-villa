export const PUBLIC_IMAGE_PROXY_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

const IPV4_PRIVATE_RANGES = [
  { max: 10, min: 10 },
  { max: 127, min: 127 },
  { max: 169, min: 169, secondMax: 254, secondMin: 254 },
  { max: 172, min: 172, secondMax: 31, secondMin: 16 },
  { max: 192, min: 192, secondMax: 168, secondMin: 168 },
];

function parseIpv4Address(hostname: string): number[] | null {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return Number.NaN;
    }

    return Number.parseInt(part, 10);
  });

  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : null;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = parseIpv4Address(hostname);

  if (!octets) {
    return false;
  }

  const [first, second] = octets;

  return IPV4_PRIVATE_RANGES.some((range) => {
    if (first < range.min || first > range.max) {
      return false;
    }

    if (range.secondMin === undefined || range.secondMax === undefined) {
      return true;
    }

    return second >= range.secondMin && second <= range.secondMax;
  });
}

function normalizeIpv6Hostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = normalizeIpv6Hostname(hostname);

  if (!normalized.includes(":")) {
    return false;
  }

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function isAllowedPublicImageHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (
    !normalizedHostname ||
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    isPrivateIpv4(normalizedHostname) ||
    isPrivateIpv6(normalizedHostname)
  ) {
    return false;
  }

  return true;
}

export function normalizePublicImageSourceUrl(sourceUrl: string | null): string | null {
  const trimmedUrl = sourceUrl?.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedUrl);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !isAllowedPublicImageHostname(url.hostname)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildPublicImageProxyUrl(proxyPath: string, sourceUrl: string | null) {
  const normalizedUrl = normalizePublicImageSourceUrl(sourceUrl);

  if (!normalizedUrl) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("url", normalizedUrl);

  return `${proxyPath}?${params.toString()}`;
}

export function buildGuideImageProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/guides/images/proxy", sourceUrl);
}

export function buildSiteAssetProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/site-assets/proxy", sourceUrl);
}

export function buildVillaCoverImageProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/houses/images/proxy", sourceUrl);
}
