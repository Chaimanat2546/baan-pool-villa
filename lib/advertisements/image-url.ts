export const DEFAULT_ADVERTISEMENT_IMAGE_URL_PATTERN =
  "https://webook-media.poolvilla.workers.dev/advertisements/:id/:imageName";

const ADVERTISEMENT_IMAGE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);

function getUrlPattern(pattern?: string | null): string {
  const trimmedPattern = pattern?.trim();

  return trimmedPattern || DEFAULT_ADVERTISEMENT_IMAGE_URL_PATTERN;
}

function buildProbeUrl(pattern: string): string {
  return pattern
    .replace(/:id\b/g, "advertisement-id")
    .replace(/:imageName\b/g, "image.webp");
}

function toSafeUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function parsePatternUrl(pattern?: string | null): URL {
  const urlPattern = getUrlPattern(pattern);
  const probeUrl = buildProbeUrl(urlPattern);
  const url = toSafeUrl(probeUrl);

  if (url) {
    return url;
  }

  return new URL(
    buildProbeUrl(DEFAULT_ADVERTISEMENT_IMAGE_URL_PATTERN),
  );
}

export function getAdvertisementImageOrigin(pattern?: string | null): string {
  return parsePatternUrl(pattern).origin;
}

export function normalizeAdvertisementImageName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const imageName = value.trim();

  if (
    !/^[a-z0-9][a-z0-9._-]*$/i.test(imageName) ||
    imageName.includes("..")
  ) {
    return null;
  }

  const extension = imageName.split(".").at(-1)?.toLowerCase();

  return extension && ADVERTISEMENT_IMAGE_EXTENSIONS.has(extension)
    ? imageName
    : null;
}

export function normalizeAdvertisementId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();

  return /^[a-z0-9][a-z0-9_-]*$/i.test(id) && !id.includes("..")
    ? id
    : null;
}

export function buildAdvertisementImageUrl(
  {
    advertisementId,
    imageName,
  }: {
    advertisementId: unknown;
    imageName: unknown;
  },
  pattern = process.env.NEXT_PUBLIC_ADVERTISEMENT_IMAGE_URL_PATTERN,
): string | null {
  const normalizedAdvertisementId = normalizeAdvertisementId(advertisementId);
  const normalizedImageName = normalizeAdvertisementImageName(imageName);

  if (!normalizedAdvertisementId || !normalizedImageName) {
    return null;
  }

  const urlPattern = getUrlPattern(pattern);
  const encodedAdvertisementId = encodeURIComponent(normalizedAdvertisementId);
  const encodedImageName = encodeURIComponent(normalizedImageName);

  if (urlPattern.includes(":id") || urlPattern.includes(":imageName")) {
    return toSafeUrl(
      urlPattern
        .replace(/:id\b/g, encodedAdvertisementId)
        .replace(/:imageName\b/g, encodedImageName),
    )?.toString() ?? null;
  }

  const baseUrl = parsePatternUrl(urlPattern);
  const basePath = baseUrl.pathname.endsWith("/")
    ? baseUrl.pathname
    : `${baseUrl.pathname}/`;

  baseUrl.pathname = `${basePath}${encodedAdvertisementId}/${encodedImageName}`;
  baseUrl.search = "";
  baseUrl.hash = "";

  return baseUrl.toString();
}
