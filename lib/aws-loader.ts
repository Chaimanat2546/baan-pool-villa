"use client";

import type { ImageLoaderProps } from "next/image";

import { buildAwsImageUrl } from "./aws-image-url";

export default function awsLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src || typeof src !== "string") {
    throw new Error("Invalid image source");
  }

  return buildAwsImageUrl({ quality, src, width });
}
