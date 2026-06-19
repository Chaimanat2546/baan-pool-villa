export const CLOUDFLARE_TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

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
  ].filter((source): source is string => Boolean(source));
  const styleSources = [
    "'self'",
    "https://fonts.googleapis.com",
    nonceSource,
  ].filter((source): source is string => Boolean(source));
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    "https://i.ytimg.com",
    "https://*.supabase.co",
    "https://*.tiktokcdn.com",
    "https://*.tiktokcdn-us.com",
  ];
  const connectSources = [
    "'self'",
    CLOUDFLARE_TURNSTILE_ORIGIN,
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
    `script-src ${scriptSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    `frame-src 'self' ${CLOUDFLARE_TURNSTILE_ORIGIN} https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com`,
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
