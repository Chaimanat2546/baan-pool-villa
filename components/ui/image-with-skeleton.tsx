"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { CspSafeImage } from "./csp-safe-image";
import { Skeleton } from "./skeleton";

type ImageWithSkeletonProps = ComponentProps<typeof CspSafeImage> & {
  skeletonClassName?: string;
};

export function ImageWithSkeleton({
  className,
  onError,
  onLoad,
  skeletonClassName = "",
  ...props
}: ImageWithSkeletonProps) {
  const [isComplete, setIsComplete] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageRef.current?.complete) {
      setIsComplete(true);
    }
  }, [props.src]);

  return (
    <>
      <CspSafeImage
        {...props}
        className={`${className ?? ""} ${isComplete ? "opacity-100" : "opacity-0"}`}
        ref={imageRef}
        onError={(event) => {
          setIsComplete(true);
          onError?.(event);
        }}
        onLoad={(event) => {
          setIsComplete(true);
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
