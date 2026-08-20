/* eslint-disable @next/next/no-img-element -- blob/data previews cannot use next/image */
import { forwardRef } from "react";
import NextImage, { type ImageLoaderProps, type ImageProps } from "next/image";
import awsLoader from "@/lib/aws-loader";
import { isPublicImageProxyPath } from "@/lib/public-image-proxy";

type CspSafeImageProps = ImageProps & {
  maximumWidth?: number;
  priority?: boolean;
};

function isRawPreviewSource(src: ImageProps["src"]): src is string {
  if (typeof src !== "string") {
    return false;
  }

  if (/^(blob|data):/.test(src) || src.endsWith(".svg")) {
    return true;
  }

  if (src.startsWith("/api/")) {
    return !isPublicImageProxyPath(src.split("?", 1)[0]);
  }

  try {
    const hostname = new URL(src).hostname.toLowerCase();

    return (
      hostname.endsWith(".tiktokcdn.com") ||
      hostname.endsWith(".tiktokcdn-us.com")
    );
  } catch {
    return false;
  }
}

export const CspSafeImage = forwardRef<HTMLImageElement, CspSafeImageProps>(function CspSafeImage({
  alt,
  className,
  fill,
  loading,
  maximumWidth,
  preload,
  priority,
  ...props
}, ref) {
  const shouldPreload = Boolean(preload || priority);
  const imageLoader = maximumWidth
    ? ({ src, width, quality }: ImageLoaderProps) =>
        awsLoader({ quality, src, width: Math.min(width, maximumWidth) })
    : undefined;

  if (!isRawPreviewSource(props.src)) {
    return (
      <NextImage
        ref={ref}
        alt={alt}
        className={className}
        fill={fill}
        loading={shouldPreload ? "eager" : loading}
        loader={imageLoader}
        preload={shouldPreload}
        {...props}
      />
    );
  }

  const { height, quality, sizes, src, width, ...imgProps } = props;
  void quality;
  void sizes;

  const imageClassName = [fill ? "absolute inset-0 h-full w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      ref={ref}
      alt={alt}
      className={imageClassName || undefined}
      height={height}
      loading={preload || priority ? "eager" : loading}
      src={src}
      width={width}
      {...imgProps}
    />
  );
});
