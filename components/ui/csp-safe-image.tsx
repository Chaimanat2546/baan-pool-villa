/* eslint-disable @next/next/no-img-element -- next/image emits inline style attributes, which strict style CSP blocks. */
import type { ImgHTMLAttributes } from "react";

type CspSafeImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "height" | "src" | "width"
> & {
  alt: string;
  fill?: boolean;
  height?: number | `${number}`;
  preload?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  src: string;
  unoptimized?: boolean;
  width?: number | `${number}`;
};

export function CspSafeImage({
  alt,
  className,
  fill,
  loading,
  preload,
  priority,
  quality,
  unoptimized,
  ...props
}: CspSafeImageProps) {
  void quality;
  void unoptimized;

  const imageClassName = [fill ? "absolute inset-0 h-full w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      alt={alt}
      className={imageClassName || undefined}
      loading={preload || priority ? "eager" : loading}
      {...props}
    />
  );
}
