import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
      },
      {
        protocol: "https",
        hostname: "www.devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
      },
      {
        protocol: "https",
        hostname: "rqizfiayvcbozlzuvbok.supabase.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
