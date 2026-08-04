"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { CspSafeImage } from "./csp-safe-image";
import { Skeleton } from "./skeleton";

type ImageWithSkeletonProps = ComponentProps<typeof CspSafeImage> & {
  skeletonClassName?: string;
};

function getSourceKey(src: ImageWithSkeletonProps["src"]): string {
  if (typeof src === "string") {
    return src;
  }

  return "default" in src ? src.default.src : src.src;
}

export function ImageWithSkeleton({
  className,
  onError,
  onLoad,
  skeletonClassName = "",
  ...props
}: ImageWithSkeletonProps) {
  const [completedSource, setCompletedSource] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const sourceKey = getSourceKey(props.src);
  const isComplete = completedSource === sourceKey;

  useEffect(() => {
    if (imageRef.current?.complete) {
      setCompletedSource(sourceKey);
    }
  }, [sourceKey]);

  return (
    <>
      <CspSafeImage
        {...props}
        className={`${className ?? ""} ${isComplete ? "opacity-100" : "opacity-0"}`}
        ref={imageRef}
        onError={(event) => {
          setCompletedSource(sourceKey);
          onError?.(event);
        }}
        onLoad={(event) => {
          setCompletedSource(sourceKey);
          onLoad?.(event);
        }}
      />
      {isComplete ? null : (
        <Skeleton
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-[1] ${skeletonClassName}`}
          data-image-loading-skeleton="true"
        />
      )}
    </>
  );
}
