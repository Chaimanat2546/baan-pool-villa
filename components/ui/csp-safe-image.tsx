/* eslint-disable @next/next/no-img-element -- blob/data previews cannot use next/image */
import { forwardRef } from "react";
import NextImage, { type ImageProps } from "next/image";

type CspSafeImageProps = ImageProps & {
  priority?: boolean;
};

const RAW_IMAGE_HOSTNAMES = new Set(["webook-media.poolvilla.workers.dev"]);

function isRawPreviewSource(src: ImageProps["src"]): src is string {
  if (typeof src !== "string") {
    return false;
  }

  if (/^(blob|data):/.test(src) || src.endsWith(".svg")) {
    return true;
  }

  try {
    const hostname = new URL(src).hostname.toLowerCase();

    return (
      RAW_IMAGE_HOSTNAMES.has(hostname) ||
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
  preload,
  priority,
  ...props
}, ref) {
  const shouldPreload = Boolean(preload || priority);

  if (!isRawPreviewSource(props.src)) {
    return (
      <NextImage
        ref={ref}
        alt={alt}
        className={className}
        fill={fill}
        loading={shouldPreload ? "eager" : loading}
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
