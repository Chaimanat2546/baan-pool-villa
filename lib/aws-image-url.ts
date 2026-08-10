export const AWS_IMAGE_LOADER_DEFAULT_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const POOLVILLA_S3_HOSTNAME = "s3.ap-southeast-1.amazonaws.com";
const POOLVILLA_S3_PATH_PREFIX = "/poolvillas.co.ltd/";
const IPV4_PRIVATE_RANGES = [
  { max: 10, min: 10 },
  { max: 127, min: 127 },
  { max: 169, min: 169, secondMax: 254, secondMin: 254 },
  { max: 172, min: 172, secondMax: 31, secondMin: 16 },
  { max: 192, min: 192, secondMax: 168, secondMin: 168 },
];

interface AwsImageUrlOptions {
  quality?: number | null;
  src: string;
  width: number;
}

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

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isAllowedPublicHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");

  return Boolean(
    normalized &&
      normalized !== "localhost" &&
      !normalized.endsWith(".localhost") &&
      !isPrivateIpv4(normalized) &&
      !isPrivateIpv6(normalized),
  );
}

function getBaseUrl(): URL {
  return new URL(
    process.env.NEXT_PUBLIC_AWS_IMAGE_LOADER_BASE_URL ??
      AWS_IMAGE_LOADER_DEFAULT_BASE_URL,
  );
}

function hasPathTraversalSegment(pathname: string): boolean {
  return pathname.split(/[\\/]+/).some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === ".." || decoded.includes("/") || decoded.includes("\\");
    } catch {
      return true;
    }
  });
}

function hasRawPathTraversal(value: string): boolean {
  const [pathLike] = value.split(/[?#]/, 1);

  try {
    return decodeURIComponent(pathLike).replace(/\\/g, "/").split("/").includes("..");
  } catch {
    return true;
  }
}

function validateImagePath(pathname: string, allowProxyPath = false): void {
  if (hasPathTraversalSegment(pathname)) {
    throw new Error("Invalid image source");
  }

  if (allowProxyPath && isPublicImageProxyPath(pathname)) {
    return;
  }

  if (!ALLOWED_EXTENSIONS.some((extension) => pathname.toLowerCase().endsWith(extension))) {
    throw new Error("Invalid file extension");
  }
}

function parsePositiveInteger(value: number | string | null | undefined): number {
  return Number.parseInt(String(value ?? ""), 10) || 0;
}

function buildRelativeImageUrl(url: URL, width: number, quality: number): string {
  const params = new URLSearchParams(url.search);

  params.set("w", String(width));
  params.set("q", String(quality));

  return `${url.pathname}?${params.toString()}`;
}

function getPoolvillaS3ImageName(sourceUrl: URL): string | null {
  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.hostname.toLowerCase() !== POOLVILLA_S3_HOSTNAME ||
    !sourceUrl.pathname.startsWith(POOLVILLA_S3_PATH_PREFIX)
  ) {
    return null;
  }

  const encodedImageName = sourceUrl.pathname.slice(POOLVILLA_S3_PATH_PREFIX.length);

  if (!encodedImageName || encodedImageName.includes("/")) {
    return null;
  }

  return encodeURIComponent(decodeURIComponent(encodedImageName));
}

export function getAwsImageLoaderOrigin(): string {
  return getBaseUrl().origin;
}

export function buildAwsImageUrl({
  quality,
  src,
  width,
}: AwsImageUrlOptions): string {
  const trimmedSrc = src.trim();

  if (!trimmedSrc || trimmedSrc.startsWith("//")) {
    throw new Error("Invalid image source");
  }

  if (hasRawPathTraversal(trimmedSrc)) {
    throw new Error("Invalid image source");
  }

  const baseUrl = getBaseUrl();
  const isRelativeSource = trimmedSrc.startsWith("/") && !trimmedSrc.startsWith("//");
  const sourceUrl = new URL(trimmedSrc, baseUrl);
  const outputUrl = new URL(baseUrl.toString());
  const validWidth = Math.min(Math.max(parsePositiveInteger(width), 16), 1920);

  if (validWidth === 0) {
    throw new Error("Invalid width value");
  }

  const validQuality = Math.min(
    Math.max(parsePositiveInteger(quality ?? sourceUrl.searchParams.get("q") ?? 75), 1),
    100,
  );

  validateImagePath(sourceUrl.pathname, isRelativeSource);
  outputUrl.search = "";

  if (isRelativeSource) {
    return buildRelativeImageUrl(sourceUrl, validWidth, validQuality);
  }

  if (sourceUrl.origin === baseUrl.origin) {
    outputUrl.pathname = sourceUrl.pathname;
    outputUrl.search = sourceUrl.search;
  } else {
    if (
      sourceUrl.protocol !== "https:" ||
      sourceUrl.username ||
      sourceUrl.password ||
      !isAllowedPublicHostname(sourceUrl.hostname)
    ) {
      throw new Error("Invalid image source");
    }

    const poolvillaS3ImageName = getPoolvillaS3ImageName(sourceUrl);

    if (!poolvillaS3ImageName) {
      sourceUrl.searchParams.set("w", String(validWidth));
      sourceUrl.searchParams.set("q", String(validQuality));

      return sourceUrl.toString();
    }

    outputUrl.pathname = `/${poolvillaS3ImageName}`;
  }

  outputUrl.searchParams.set("w", String(validWidth));
  outputUrl.searchParams.set("q", String(validQuality));

  return outputUrl.href;
}
import { isPublicImageProxyPath } from "./public-image-proxy";
