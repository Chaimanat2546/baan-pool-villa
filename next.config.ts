import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const CLOUDFLARE_TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function getHttpsOrigin(value: string | undefined): string | null {
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

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  CLOUDFLARE_TURNSTILE_ORIGIN,
];

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
  getHttpsOrigin(process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL),
  ...(isDevelopment ? ["ws:", "wss:"] : []),
].filter((source): source is string => Boolean(source));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `img-src ${imageSources.join(" ")}`,
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' https://fonts.googleapis.com",
      `script-src ${scriptSources.join(" ")}`,
      `connect-src ${connectSources.join(" ")}`,
      `frame-src 'self' ${CLOUDFLARE_TURNSTILE_ORIGIN} https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com`,
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
  images: {
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1440, 1920],
    formats: ["image/avif", "image/webp"],
    imageSizes: [64, 96, 128, 160, 192, 244, 256, 292, 320, 384, 448, 512],
    minimumCacheTTL: 60 * 60 * 24 * 365,
    qualities: [60, 75],
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "www.devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "rqizfiayvcbozlzuvbok.supabase.co",
        pathname: "/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "s3.ap-southeast-1.amazonaws.com",
        pathname: "/poolvillas.co.ltd/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws",
        pathname: "/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
