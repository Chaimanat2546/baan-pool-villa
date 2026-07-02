export const CLOUDFLARE_TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const CLOUDFLARE_INSIGHTS_ORIGIN = "https://static.cloudflareinsights.com";
const AWS_IMAGE_LOADER_DEFAULT_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws";

export function getHttpsOrigin(value: string | undefined): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy({
  isDevelopment,
  nonce,
  supabaseUrl,
}: {
  isDevelopment: boolean;
  nonce?: string;
  supabaseUrl?: string;
}): string {
  const nonceSource = nonce ? `'nonce-${nonce}'` : null;
  const scriptSources = [
    "'self'",
    nonceSource,
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    CLOUDFLARE_TURNSTILE_ORIGIN,
    CLOUDFLARE_INSIGHTS_ORIGIN,
  ].filter((source): source is string => Boolean(source));
  const styleSources = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    nonceSource,
  ].filter((source): source is string => Boolean(source));
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    getHttpsOrigin(process.env.NEXT_PUBLIC_AWS_IMAGE_LOADER_BASE_URL) ??
      getHttpsOrigin(AWS_IMAGE_LOADER_DEFAULT_BASE_URL),
    "https://devillegroups.com",
    "https://www.devillegroups.com",
    "https://i.ytimg.com",
    "https://s3.ap-southeast-1.amazonaws.com",
    "https://*.supabase.co",
    "https://*.tiktokcdn.com",
    "https://*.tiktokcdn-us.com",
  ].filter((source): source is string => Boolean(source));
  const connectSources = [
    "'self'",
    CLOUDFLARE_TURNSTILE_ORIGIN,
    CLOUDFLARE_INSIGHTS_ORIGIN,
    "https://www.tiktok.com",
    getHttpsOrigin(supabaseUrl),
    ...(isDevelopment ? ["ws:", "wss:"] : []),
  ].filter((source): source is string => Boolean(source));

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `style-src ${styleSources.join(" ")}`,
    "style-src-attr 'unsafe-inline'",
    `script-src ${scriptSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    `frame-src 'self' ${CLOUDFLARE_TURNSTILE_ORIGIN} https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com`,
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
