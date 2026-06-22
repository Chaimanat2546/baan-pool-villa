import type { NextConfig } from "next";

import { buildContentSecurityPolicy } from "./lib/security/csp";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy({
      isDevelopment: process.env.NODE_ENV === "development",
      supabaseUrl: process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL,
    }),
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
    loader: "custom",
    loaderFile: "./lib/aws-loader.ts",
    minimumCacheTTL: 60 * 60 * 24 * 365,
    qualities: [60, 75],
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
