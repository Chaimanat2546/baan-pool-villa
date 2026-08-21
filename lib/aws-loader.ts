"use client";

import type { ImageLoaderProps } from "next/image";

import { buildAwsImageUrl } from "./aws-image-url";

const MOBILE_HERO_MAXIMUM_WIDTH = 828;

function getImageQuality({ src, width, quality }: ImageLoaderProps) {
  const pathname = new URL(src, "https://image-loader.local").pathname;

  return pathname === "/api/site-assets/images/hero" &&
    width <= MOBILE_HERO_MAXIMUM_WIDTH
    ? 60
    : quality;
}

export default function awsLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src || typeof src !== "string") {
    throw new Error("Invalid image source");
  }

  return buildAwsImageUrl({
    quality: getImageQuality({ quality, src, width }),
    src,
    width,
  });
}
