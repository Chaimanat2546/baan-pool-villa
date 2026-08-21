"use client";

import {
  useEffect,
  useState,
  type ComponentProps,
  type SyntheticEvent,
} from "react";

import { CspSafeImage } from "./csp-safe-image";

type ProgressiveImageProps = Omit<
  ComponentProps<typeof CspSafeImage>,
  "loading" | "maximumWidth" | "onError" | "onLoad" | "preload" | "priority"
> & {
  previewSrc?: ComponentProps<typeof CspSafeImage>["src"];
  previewActive: boolean;
  previewFetchPriority?: "high" | "low" | "auto";
  previewLoading?: "eager" | "lazy";
  previewMaximumWidth?: number;
  fullImageActive: boolean;
  fullImageFetchPriority?: "high" | "low" | "auto";
  fullImageLoading?: "eager" | "lazy";
  fullImagePreload?: boolean;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ProgressiveImage({
  className,
  fill,
  fullImageActive,
  fullImageFetchPriority,
  fullImageLoading,
  fullImagePreload,
  height,
  onError,
  onLoad,
  previewActive,
  previewFetchPriority,
  previewLoading,
  previewMaximumWidth = 64,
  previewSrc,
  src,
  width,
  ...props
}: ProgressiveImageProps) {
  const [previewFailureSource, setPreviewFailureSource] = useState<
    ProgressiveImageProps["src"] | null
  >(null);
  const [fullFailureSource, setFullFailureSource] = useState<
    ProgressiveImageProps["src"] | null
  >(null);
  const [fullLoadedSource, setFullLoadedSource] = useState<
    ProgressiveImageProps["src"] | null
  >(null);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);

    return () => query.removeEventListener("change", updatePreference);
  }, []);

  const previewSource = previewSrc ?? src;
  const previewFailed = previewFailureSource === previewSource;
  const fullFailed = fullFailureSource === src;
  const fullLoaded = fullLoadedSource === src;
  const showPreview = previewActive && !previewFailed;
  const showFull = fullImageActive && !fullFailed;
  const showFallback = !showPreview && (!showFull || !fullLoaded);
  const containerClassName = fill
    ? "absolute inset-0 overflow-hidden"
    : "relative inline-block overflow-hidden";
  const imageClassName = className ?? "";

  return (
    <span
      className={containerClassName}
      data-progressive-image
      style={fill ? undefined : { height, width }}
    >
      {showFallback ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--site-border)]"
          data-progressive-image-fallback
        />
      ) : null}
      {showPreview ? (
        <CspSafeImage
          {...props}
          alt={props.alt}
          className={`${imageClassName} scale-105 blur-lg`}
          data-maximum-width={previewMaximumWidth}
          data-progressive-preview
          fill={fill}
          fetchPriority={previewFetchPriority}
          height={height}
          loading={previewLoading}
          maximumWidth={previewMaximumWidth}
          quality={60}
          src={previewSource}
          width={width}
          onError={(event) => {
            setPreviewFailureSource(previewSource);
            onError?.(event);
          }}
        />
      ) : null}
      {showFull ? (
        <CspSafeImage
          {...props}
          alt={props.alt}
          className={[
            imageClassName,
            fullLoaded ? "opacity-100" : "opacity-0",
            reducedMotion ? "" : "transition-opacity duration-300",
          ]
            .filter(Boolean)
            .join(" ")}
          data-progressive-full
          fetchPriority={fullImageFetchPriority}
          fill={fill}
          height={height}
          loading={fullImageLoading}
          preload={fullImagePreload}
          src={src}
          width={width}
          onError={(event) => {
            setFullFailureSource(src);
            onError?.(event);
          }}
          onLoad={(event) => {
            setFullLoadedSource(src);
            onLoad?.(event);
          }}
        />
      ) : null}
    </span>
  );
}
