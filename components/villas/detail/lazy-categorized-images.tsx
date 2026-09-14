"use client";

import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff } from "lucide-react";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import { GalleryLightbox } from "./gallery-lightbox";
import { buildGalleryDisplaySrc } from "./gallery-urls";
import type { GalleryCategory, GalleryItem } from "./types";

interface LazyCategorizedImagesProps {
  listingId: string;
  galleryStyle: GalleryStyleSettings;
  previewCategories: GalleryCategory[];
}

export function LazyCategorizedImages({
  listingId,
  galleryStyle,
  previewCategories,
}: LazyCategorizedImagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRenderImages, setShouldRenderImages] = useState(false);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const isOpen = activeItem !== null;
  const activeCategory = previewCategories.find(
    (category) => category.key === activeItem?.zoneKey,
  );
  const withImageFallback = (item: GalleryItem) =>
    failedImageUrls.has(item.url) ? { ...item, url: "" } : item;
  const handleImageError = (url: string) => {
    setFailedImageUrls((current) =>
      current.has(url) ? current : new Set([...current, url]),
    );
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const modal = modalRef.current;
    modal
      ?.querySelector<HTMLButtonElement>('button[aria-label="ปิดแกลเลอรี"]')
      ?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const controls = modal?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!controls?.length) {
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      window.removeEventListener("keydown", trapFocus);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

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
    <>
      <div
        ref={containerRef}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
        data-detail-categorized-images={shouldRenderImages ? "loaded" : "deferred"}
      >
        {previewCategories.map((category) => {
          const previewItem = category.items[0];
          const previewImageSrc =
            shouldRenderImages && previewItem
              ? buildGalleryDisplaySrc(
                  listingId,
                  withImageFallback(previewItem),
                  1200,
                  75,
                )
              : null;

          if (!previewItem) {
            return null;
          }

          return (
            <button
              key={category.key}
              type="button"
              aria-label={`ดูรูปหมวด${category.label}`}
              aria-haspopup="dialog"
              className="min-w-0 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] text-left transition hover:border-[var(--site-primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-primary)]"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setActiveItem(previewItem);
              }}
            >
              <div className="relative aspect-[4/3] bg-[var(--site-surface-tint)]">
                {previewImageSrc ? (
                  <Image
                    alt={previewItem.caption ?? category.label}
                    className="object-cover"
                    fill
                    loading="lazy"
                    quality={75}
                    sizes="auto, (max-width: 639px) 100vw, (max-width: 1023px) 50vw, 100vw"
                    src={previewImageSrc}
                    onError={() => handleImageError(previewItem.url)}
                  />
                ) : shouldRenderImages ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--site-muted)]">
                    <ImageOff aria-hidden="true" className="h-8 w-8" />
                    <span className="text-sm">ไม่สามารถโหลดรูปได้</span>
                  </div>
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
            </button>
          );
        })}
      </div>
      {activeItem && activeCategory
        ? createPortal(
            <div ref={modalRef}>
              <GalleryLightbox
                activeItem={withImageFallback(activeItem)}
                categories={[{
                  ...activeCategory,
                  items: activeCategory.items.map(withImageFallback),
                }]}
                listing={{ id: listingId }}
                title={activeCategory.label}
                onClose={() => setActiveItem(null)}
                onImageError={handleImageError}
                onSelect={setActiveItem}
                showCategorySelector={false}
                style={galleryStyle}
                thumbnailPlacement="bottom"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
