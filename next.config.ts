import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1440, 1920],
    formats: ["image/avif", "image/webp"],
    imageSizes: [64, 96, 128, 160, 192, 244, 256, 292, 320, 384, 448, 512],
    minimumCacheTTL: 60 * 60 * 24 * 30,
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
    ],
  },
};

export default nextConfig;
