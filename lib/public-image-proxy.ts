export const PUBLIC_IMAGE_PROXY_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000";

export const PUBLIC_IMAGE_TRANSFORM_WIDTHS = [
  64,
  96,
  128,
  160,
  192,
  244,
  256,
  292,
  320,
  384,
  390,
  448,
  512,
  640,
  750,
  828,
  1080,
  1200,
  1440,
  1920,
] as const;

export const PUBLIC_IMAGE_TRANSFORM_QUALITIES = [60, 75] as const;

export type PublicImageTransformWidth = (typeof PUBLIC_IMAGE_TRANSFORM_WIDTHS)[number];
export type PublicImageTransformQuality =
  (typeof PUBLIC_IMAGE_TRANSFORM_QUALITIES)[number];

export interface PublicImageTransformOptions {
  quality?: number | null;
  width?: number | null;
}

export interface PublicImageTransformParams {
  quality?: PublicImageTransformQuality;
  width?: PublicImageTransformWidth;
}

export type PublicImageTransformParseResult =
  | { params: PublicImageTransformParams; valid: true }
  | { params: null; valid: false };

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

function isAllowedPublicImageWidth(width: number): width is PublicImageTransformWidth {
  return PUBLIC_IMAGE_TRANSFORM_WIDTHS.some((allowedWidth) => allowedWidth === width);
}

function isAllowedPublicImageQuality(
  quality: number,
): quality is PublicImageTransformQuality {
  return PUBLIC_IMAGE_TRANSFORM_QUALITIES.some(
    (allowedQuality) => allowedQuality === quality,
  );
}

function parseTransformInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

export function parsePublicImageTransformParams(
  searchParams: URLSearchParams,
): PublicImageTransformParseResult {
  const widthValue = searchParams.get("w");
  const qualityValue = searchParams.get("q");
  const params: PublicImageTransformParams = {};

  if (widthValue !== null) {
    const width = parseTransformInteger(widthValue);

    if (width === null || !isAllowedPublicImageWidth(width)) {
      return { params: null, valid: false };
    }

    params.width = width;
  }

  if (qualityValue !== null) {
    const quality = parseTransformInteger(qualityValue);

    if (quality === null || !isAllowedPublicImageQuality(quality)) {
      return { params: null, valid: false };
    }

    params.quality = quality;
  }

  return { params, valid: true };
}

function appendPublicImageTransformParams(
  params: URLSearchParams,
  options: PublicImageTransformOptions | undefined,
) {
  const width = options?.width;
  const quality = options?.quality;

  if (typeof width === "number" && isAllowedPublicImageWidth(width)) {
    params.set("w", width.toString());
  }

  if (typeof quality === "number" && isAllowedPublicImageQuality(quality)) {
    params.set("q", quality.toString());
  }
}

function buildPublicImageProxyUrl(
  proxyPath: string,
  sourceUrl: string | null,
  options?: PublicImageTransformOptions,
) {
  const normalizedUrl = normalizePublicImageSourceUrl(sourceUrl);

  if (!normalizedUrl) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("url", normalizedUrl);
  appendPublicImageTransformParams(params, options);

  return `${proxyPath}?${params.toString()}`;
}

function buildPublicImageProxyPath(
  proxyPath: string,
  options?: PublicImageTransformOptions,
) {
  const params = new URLSearchParams();
  appendPublicImageTransformParams(params, options);
  const query = params.toString();

  return query ? `${proxyPath}?${query}` : proxyPath;
}

function normalizePathSegment(value: string) {
  const segment = value.trim();

  return segment && !segment.includes("/") ? encodeURIComponent(segment) : null;
}

export function buildGuideImageProxyUrl(
  sourceUrl: string | null,
  options?: PublicImageTransformOptions,
) {
  return buildPublicImageProxyUrl("/api/guides/images/proxy", sourceUrl, options);
}

export function buildSiteAssetProxyUrl(
  sourceUrl: string | null,
  options?: PublicImageTransformOptions,
) {
  return buildPublicImageProxyUrl("/api/site-assets/proxy", sourceUrl, options);
}

export function buildVillaCoverImageProxyUrl(
  sourceUrl: string | null,
  options?: PublicImageTransformOptions,
) {
  return buildPublicImageProxyUrl("/api/houses/images/proxy", sourceUrl, options);
}

export function buildVillaCoverImageProxyPath(
  listingId: string,
  options?: PublicImageTransformOptions,
) {
  const normalizedListingId = normalizePathSegment(listingId);

  return normalizedListingId
    ? buildPublicImageProxyPath(`/api/houses/images/${normalizedListingId}`, options)
    : null;
}

export function buildGuideCoverImageProxyPath(
  slug: string,
  options?: PublicImageTransformOptions,
) {
  const normalizedSlug = normalizePathSegment(slug);

  return normalizedSlug
    ? buildPublicImageProxyPath(
        `/api/guides/images/${normalizedSlug}/cover`,
        options,
      )
    : null;
}

export function buildGuideContentImageProxyPath(
  slug: string,
  blockIndex: number,
  options?: PublicImageTransformOptions,
) {
  const normalizedSlug = normalizePathSegment(slug);

  if (
    !normalizedSlug ||
    !Number.isInteger(blockIndex) ||
    blockIndex < 0
  ) {
    return null;
  }

  return buildPublicImageProxyPath(
    `/api/guides/images/${normalizedSlug}/content/${blockIndex}`,
    options,
  );
}

export function buildSiteAssetImageProxyPath(
  asset: "hero" | "logo",
  slideIndex?: number,
) {
  if (asset === "hero" && Number.isInteger(slideIndex) && slideIndex! >= 0) {
    return `/api/site-assets/images/hero?slide=${slideIndex}`;
  }

  return `/api/site-assets/images/${asset}`;
}

export function buildCustomerReviewImageProxyPath(imageId: string) {
  const normalizedImageId = normalizePathSegment(imageId);

  return normalizedImageId
    ? `/api/customer-reviews/images/${normalizedImageId}`
    : null;
}

export function buildVillaGalleryImageProxyUrl(
  listingId: string,
  sourceUrl: string | null,
  options?: PublicImageTransformOptions,
) {
  const trimmedListingId = listingId.trim();

  if (!/^[1-9]\d*$/.test(trimmedListingId)) {
    return null;
  }

  return buildPublicImageProxyUrl(
    `/api/villas/${encodeURIComponent(trimmedListingId)}/images`,
    sourceUrl,
    options,
  );
}

export function buildVillaGalleryImageProxyPath(
  listingId: string,
  imageId: number,
  options?: PublicImageTransformOptions,
) {
  const trimmedListingId = listingId.trim();

  if (!/^[1-9]\d*$/.test(trimmedListingId) || !Number.isInteger(imageId) || imageId <= 0) {
    return null;
  }

  const params = new URLSearchParams({ imageId: imageId.toString() });
  appendPublicImageTransformParams(params, options);

  return `/api/villas/${encodeURIComponent(trimmedListingId)}/images?${params.toString()}`;
}
