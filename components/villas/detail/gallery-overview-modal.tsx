"use client";

import { ImageOff, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";
import { getGalleryModalStyle } from "./gallery-modal-style";
import { buildGalleryDisplaySrc } from "./gallery-urls";
import { getVillaTitle } from "./helpers";
import type { GalleryCategory, GalleryItem } from "./types";
import { useLockedBodyScroll } from "./use-locked-body-scroll";

interface GalleryOverviewModalProps {
  categories: GalleryCategory[];
  listing: VillaListing;
  onClose: () => void;
  onImageError: (url: string) => void;
  onSelect: (item: GalleryItem) => void;
  style: GalleryStyleSettings;
}

function MasonryGrid({
  categoryKey,
  children,
}: {
  categoryKey: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useCallback(() => {
    const container = containerRef.current;
    if (!container || container.clientWidth === 0) return;

    const columnCount =
      container.clientWidth >= 1024 ? 4 : container.clientWidth >= 640 ? 3 : 2;
    const gap = container.clientWidth >= 640 ? 12 : 8;
    const itemWidth =
      (container.clientWidth - gap * (columnCount - 1)) / columnCount;
    const columnHeights = Array<number>(columnCount).fill(0);
    const items = container.querySelectorAll<HTMLElement>(
      ":scope > [data-gallery-overview-item]",
    );

    items.forEach((item) => {
      item.style.width = `${itemWidth}px`;
      const image = item.querySelector("img");
      if (image?.naturalWidth && image.naturalHeight) {
        item.style.height = `${itemWidth * (image.naturalHeight / image.naturalWidth)}px`;
        item.style.minHeight = "0";
      }
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      const x = column * (itemWidth + gap);
      const y = columnHeights[column];
      item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      columnHeights[column] = y + item.offsetHeight + gap;
    });

    container.style.height = `${Math.max(...columnHeights) - gap}px`;
  }, []);

  useEffect(() => {
    layout();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", layout);
      return () => window.removeEventListener("resize", layout);
    }

    const observer = new ResizeObserver(layout);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [layout]);

  return (
    <div
      className="relative w-full"
      data-gallery-overview-masonry={categoryKey}
      onError={layout}
      onLoad={layout}
      ref={containerRef}
    >
      {children}
    </div>
  );
}

export function GalleryOverviewModal({
  categories,
  listing,
  onClose,
  onImageError,
  onSelect,
  style,
}: GalleryOverviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `gallery-overview-title-${listing.id}`;

  useLockedBodyScroll(true);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-[var(--gallery-modal-background,var(--site-primary-hover))] text-[var(--gallery-modal-text,var(--site-on-primary))]"
      data-gallery-overview="true"
      role="dialog"
      style={getGalleryModalStyle(style)}
    >
      <header className="sticky top-0 z-30 border-b border-white/15 bg-[var(--gallery-modal-background,var(--site-primary-hover))]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold opacity-60">
              {getVillaTitle(listing.id, listing.title)}
            </p>
            <h2 className="truncate text-xl font-black sm:text-2xl" id={titleId}>
              ประเภทรูป
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="ปิดหน้ารวมรูป"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          aria-label="เลือกประเภทรูป"
          className="mx-auto mt-3 flex max-w-7xl snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => (
            <button
              className="shrink-0 snap-start rounded-full border border-current/20 bg-white/10 px-4 py-2 text-xs font-black transition hover:bg-white/20"
              key={category.key}
              onClick={() => {
                document
                  .getElementById(`gallery-overview-${listing.id}-${category.key}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              type="button"
            >
              {category.label} ({category.items.length})
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6 sm:py-8">
        {categories.map((category) => (
          <section
            className="scroll-mt-36"
            id={`gallery-overview-${listing.id}-${category.key}`}
            key={category.key}
          >
            <div className="mb-4 flex items-end justify-between gap-3">
              <h3 className="text-lg font-black sm:text-xl">{category.label}</h3>
              <span className="text-xs font-bold opacity-60">
                {category.items.length} รูป
              </span>
            </div>
            <MasonryGrid categoryKey={category.key}>
              {category.items.map((item) => {
                const src = buildGalleryDisplaySrc(listing.id, item, 828, 60);

                return (
                  <button
                    aria-label={`เปิดรูป ${item.caption ?? category.label}`}
                    className="group absolute left-0 top-0 overflow-hidden rounded-xl bg-white/10 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:rounded-2xl"
                    data-gallery-overview-item={item.key}
                    key={item.key}
                    onClick={() => {
                      onSelect(item);
                    }}
                    style={{ minHeight: "6rem" }}
                    type="button"
                  >
                    {src ? (
                      <Image
                        alt={item.caption ?? category.label}
                        className="object-contain transition duration-300 group-hover:scale-[1.03]"
                        fill
                        loading="lazy"
                        onError={() => {
                          onImageError(item.url);
                        }}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        src={src}
                      />
                    ) : (
                      <span className="grid h-full place-items-center opacity-60">
                        <ImageOff className="h-8 w-8" />
                      </span>
                    )}
                  </button>
                );
              })}
            </MasonryGrid>
          </section>
        ))}
      </div>
    </div>
  );
}
