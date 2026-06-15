"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buildVillaGalleryImageProxyUrl } from "@/lib/public-image-proxy";
import type { VillaListing } from "@/lib/villas/types";
import type { GalleryCategory } from "./types";

interface LazyCategorizedImagesProps {
  listing: VillaListing;
  previewCategories: GalleryCategory[];
}

export function LazyCategorizedImages({
  listing,
  previewCategories,
}: LazyCategorizedImagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRenderImages, setShouldRenderImages] = useState(false);

  useEffect(() => {
    if (shouldRenderImages) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      const timeoutId = globalThis.setTimeout(() => {
        setShouldRenderImages(true);
      }, 0);

      return () => {
        globalThis.clearTimeout(timeoutId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderImages(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [shouldRenderImages]);

  return (
    <div
      ref={containerRef}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
      data-detail-categorized-images={shouldRenderImages ? "loaded" : "deferred"}
    >
      {previewCategories.map((category) => {
        const previewItem = category.items[0];
        const previewImageSrc =
          shouldRenderImages && previewItem
            ? buildVillaGalleryImageProxyUrl(listing.id, previewItem.url, {
                quality: 60,
                width: 640,
              })
            : null;

        if (!previewItem) {
          return null;
        }

        return (
          <div
            key={category.key}
            className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)]"
          >
            <div className="relative aspect-[4/3] bg-[var(--site-surface-tint)]">
              {previewImageSrc ? (
                <Image
                  alt={previewItem.caption ?? category.label}
                  className="object-cover"
                  fill
                  loading="eager"
                  sizes="(max-width: 1024px) 50vw, 320px"
                  src={previewImageSrc}
                  unoptimized
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-full w-full animate-pulse bg-[linear-gradient(110deg,var(--site-surface-tint),var(--site-surface-soft),var(--site-surface-tint))] bg-[length:220%_100%]"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-sm font-black text-[var(--site-text)]">
                {category.label}
              </span>
              <span className="shrink-0 text-xs font-bold text-[var(--site-muted)]">
                {category.items.length.toLocaleString("th-TH")} รูป
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
