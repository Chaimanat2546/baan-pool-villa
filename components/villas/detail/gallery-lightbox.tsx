import { ChevronLeft, ChevronRight, Download, ImageOff, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { VillaListing } from "@/lib/villas/types";
import { buildGalleryDisplaySrc, buildGalleryDownloadHref } from "./gallery-urls";
import { getGalleryItemDescription, getVillaTitle } from "./helpers";
import type { GalleryCategory, GalleryItem } from "./types";
/**
 * Render a full-screen gallery lightbox for viewing and navigating a listing's images.
 *
 * Renders a modal UI with the active image, download link, navigation controls, category list, description, and a thumbnail strip. Locks page scroll while open, aligns the thumbnail strip to the active thumbnail, supports keyboard (Escape, ArrowLeft, ArrowRight) and touch swipe navigation, and reports image load errors.
 *
 * @param activeItem - The currently selected gallery item; when `null` the component renders `null`.
 * @param categories - Gallery categories used to group and navigate images.
 * @param listing - The villa listing used to build the gallery title and download link.
 * @param onClose - Called when the lightbox should be closed (e.g., close button or Escape key).
 * @param onImageError - Called with the image `url` when an image fails to load.
 * @param onSelect - Called with a `GalleryItem` when the user selects or navigates to a different image.
 * @returns The lightbox DOM element, or `null` when `activeItem` is `null`.
 */
export function GalleryLightbox({

  activeItem,

  categories,

  listing,

  onClose,

  onImageError,

  onSelect,

}: {

  activeItem: GalleryItem | null;

  categories: GalleryCategory[];

  listing: VillaListing;

  onClose: () => void;

  onImageError: (url: string) => void;

  onSelect: (item: GalleryItem) => void;

}) {

  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeItem) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [activeItem]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const thumbnailStrip = thumbnailStripRef.current;
      const activeThumbnail = thumbnailStrip?.querySelector("[data-active-thumbnail='true']");

      if (!thumbnailStrip || !(activeThumbnail instanceof HTMLElement)) {
        return;
      }

      const stripRect = thumbnailStrip.getBoundingClientRect();
      const thumbnailRect = activeThumbnail.getBoundingClientRect();
      const shouldScrollVertically =
        window.matchMedia("(min-width: 1024px)").matches &&
        thumbnailStrip.scrollHeight > thumbnailStrip.clientHeight;
      const targetLeft =
        thumbnailStrip.scrollLeft +
        thumbnailRect.left -
        stripRect.left -
        thumbnailStrip.clientWidth / 2 +
        thumbnailRect.width / 2;
      const targetTop =
        thumbnailStrip.scrollTop +
        thumbnailRect.top -
        stripRect.top -
        thumbnailStrip.clientHeight / 2 +
        thumbnailRect.height / 2;

      thumbnailStrip.scrollTo({
        behavior: "auto",
        left: shouldScrollVertically ? thumbnailStrip.scrollLeft : Math.max(0, targetLeft),
        top: shouldScrollVertically ? Math.max(0, targetTop) : thumbnailStrip.scrollTop,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const activeCategoryForKey =
        categories.find((category) => category.key === activeItem.zoneKey) ??
        categories[0];
      const activeItemsForKey = activeCategoryForKey?.items ?? [];

      if (activeItemsForKey.length <= 1) {
        return;
      }

      const activeIndexForKey = Math.max(
        activeItemsForKey.findIndex((item) => item.key === activeItem.key),
        0,
      );

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect(
          activeItemsForKey[
            (activeIndexForKey - 1 + activeItemsForKey.length) %
              activeItemsForKey.length
          ],
        );
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelect(activeItemsForKey[(activeIndexForKey + 1) % activeItemsForKey.length]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItem, categories, onClose, onSelect]);

  if (!activeItem) {

    return null;

  }

  const activeCategory =

    categories.find((category) => category.key === activeItem.zoneKey) ??

    categories[0];

  const activeItems = activeCategory?.items ?? [];

  const activeIndex = Math.max(

    activeItems.findIndex((item) => item.key === activeItem.key),

    0,

  );

  const previousItem =

    activeItems[(activeIndex - 1 + activeItems.length) % activeItems.length];

  const nextItem = activeItems[(activeIndex + 1) % activeItems.length];
  const activeImageDownloadHref = buildGalleryDownloadHref(listing.id, activeItem);
  const activeImageDisplaySrc = buildGalleryDisplaySrc(
    listing.id,
    activeItem,
    1920,
    75,
  );
  const isActiveImageLoading =
    Boolean(activeImageDisplaySrc) && loadedImageKey !== activeItem.key;
  const handleImageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };
  const handleImageTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touchStartX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (touchStartX === null || activeItems.length <= 1) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX;

    if (touchEndX === undefined) {
      return;
    }

    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) < 48) {
      return;
    }

    onSelect(deltaX > 0 ? previousItem : nextItem);
  };

  return (

    <div className="fixed inset-0 z-[70] overscroll-contain bg-[var(--site-primary-hover)] text-[var(--site-on-primary)]">
      <div className="flex h-dvh flex-col overflow-hidden">

        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">

          <div className="min-w-0">

            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--site-on-primary)] opacity-60 sm:text-xs sm:tracking-[0.18em]">
              แกลเลอรีรูปบ้าน

            </p>

            <h2 className="truncate text-lg font-black sm:text-2xl">

              {getVillaTitle(listing.id)}

            </h2>

          </div>

          <button

            type="button"

            aria-label="ปิดแกลเลอรี"

            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-[var(--site-on-primary)] transition hover:bg-white/20"
            onClick={onClose}

          >

            <X className="h-5 w-5" />

          </button>

        </header>

        <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6 lg:hidden">

          <div className="mb-2 flex items-center justify-between gap-3">

            <p className="text-xs font-black text-[var(--site-on-primary)] opacity-60">เลือกหมวดหมู่</p>
            <p className="text-[11px] font-bold text-[var(--site-on-primary)] opacity-[0.45] lg:hidden">เลื่อนซ้ายขวา</p>
          </div>

          <div className="flex snap-x gap-2 overflow-x-auto pb-1">

          {categories.map((category) => (

            <button

              key={category.key}

              type="button"

              className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2 text-xs font-black transition ${

                category.key === activeItem.zoneKey

                  ? "bg-[var(--site-surface)] text-[var(--site-text)]"

                  : "bg-white/10 text-[var(--site-on-primary)] hover:bg-white/20"
              }`}

              onClick={() => {
                onSelect(category.items[0]);
              }}
            >

              {category.label}

              <span className="ml-2 text-[11px] opacity-70">{category.items.length} รูป</span>

            </button>

          ))}

          </div>

        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden px-3 pb-8 pt-3 sm:gap-3 sm:px-6 sm:py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 lg:px-6 lg:pb-6 lg:pt-5">

          <div
            className="relative h-[46dvh] min-h-[250px] min-w-0 max-w-full shrink-0 touch-pan-y overflow-hidden rounded-2xl bg-white/5 sm:h-auto sm:flex-1 lg:h-auto lg:min-h-0"
            onTouchStart={handleImageTouchStart}
            onTouchEnd={handleImageTouchEnd}
          >
            {activeImageDisplaySrc ? (
            <Image

              key={activeItem.key}

              src={activeImageDisplaySrc}

              alt={`${getVillaTitle(listing.id)} ${activeItem.zoneLabel}`}

              fill

              loading="eager"

              fetchPriority="high"

              unoptimized

              sizes="(max-width: 1024px) 100vw, calc(100vw - 400px)"

              className="object-contain"

              onLoad={() => {
                setLoadedImageKey(activeItem.key);
              }}

              onError={() => {
                setLoadedImageKey(activeItem.key);
                onImageError(activeItem.url);
              }}
            />
            ) : (
              <div className="grid h-full place-items-center text-[var(--site-on-primary)] opacity-70">
                <ImageOff className="h-12 w-12" />
              </div>
            )}

            {isActiveImageLoading ? (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/20 backdrop-blur-[1px]">
                <div className="h-full w-full animate-pulse bg-[linear-gradient(110deg,rgba(255,255,255,0.06),rgba(255,255,255,0.16),rgba(255,255,255,0.06))] bg-[length:220%_100%]" />
                <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
              </div>
            ) : null}

            <div className="absolute left-2 top-2 z-20 max-w-[calc(100%_-_4.5rem)] rounded-full bg-black/50 px-3 py-1.5 text-xs font-black text-[var(--site-on-primary)] backdrop-blur sm:hidden">
              {activeItem.zoneLabel}
              <span className="ml-2 opacity-70">
                {activeIndex + 1}/{activeItems.length}
              </span>
            </div>

            <div className="absolute left-4 top-4 z-20 hidden max-w-[calc(100%_-_5.5rem)] items-center rounded-full bg-black/50 px-4 py-2 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_34px_rgba(0,0,0,0.2)] backdrop-blur lg:inline-flex">
              {activeItem.zoneLabel}
              <span className="mx-2 opacity-50">•</span>
              <span className="opacity-80">
                {activeIndex + 1}/{activeItems.length}
              </span>
            </div>

            <a
              href={activeImageDownloadHref}
              aria-label="ดาวน์โหลดรูปนี้"
              title="ดาวน์โหลดรูปนี้"
              download
              className="absolute right-2 top-2 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-[var(--site-on-primary)] backdrop-blur transition hover:bg-black/65 sm:right-3 sm:top-3 sm:h-11 sm:w-11"
            >
              <Download className="h-5 w-5" />
            </a>

            {activeItems.length > 1 ? (

              <>

                <button

                  type="button"

                  aria-label="รูปก่อนหน้า"

                  className="absolute left-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[var(--site-on-primary)] backdrop-blur transition hover:bg-black/60 sm:left-3 sm:h-11 sm:w-11"

                  onClick={() => {
                    onSelect(previousItem);
                  }}
                >

                  <ChevronLeft className="h-5 w-5" />

                </button>

                <button

                  type="button"

                  aria-label="รูปถัดไป"

                  className="absolute right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[var(--site-on-primary)] backdrop-blur transition hover:bg-black/60 sm:right-3 sm:h-11 sm:w-11"

                  onClick={() => {
                    onSelect(nextItem);
                  }}
                >

                  <ChevronRight className="h-5 w-5" />

                </button>

              </>

            ) : null}

          </div>

          <aside className="min-h-0 min-w-0 max-w-full shrink-0 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">

            <div className="hidden shrink-0 rounded-2xl bg-white/10 p-3 lg:block">
              <p className="text-xs font-black text-[var(--site-on-primary)] opacity-60">เลือกหมวดหมู่</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`min-h-10 rounded-xl px-3 py-2 text-left text-xs font-black transition ${
                      category.key === activeItem.zoneKey
                        ? "bg-[var(--site-surface)] text-[var(--site-text)]"
                        : "bg-white/10 text-[var(--site-on-primary)] hover:bg-white/20"
                    }`}
                    onClick={() => {
                      onSelect(category.items[0]);
                    }}
                  >
                    <span className="block truncate">{category.label}</span>
                    <span className="text-[11px] opacity-70">{category.items.length} รูป</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 sm:p-4 lg:mt-3 lg:shrink-0">
              <p className="text-xs font-black text-[var(--site-on-primary)] opacity-60">หมวดรูป</p>
              <h3 className="mt-1 text-xl font-black">{activeItem.zoneLabel}</h3>

              <p className="mt-2 text-sm leading-6 text-[var(--site-on-primary)] opacity-70">
                {getGalleryItemDescription(activeItem)}

              </p>

            </div>

            <div ref={thumbnailStripRef} className="mt-2 flex max-w-full snap-x gap-2 overflow-x-auto overflow-y-hidden pb-1 sm:mt-3 sm:pb-2 lg:min-h-0 lg:flex-1 lg:grid lg:auto-rows-[112px] lg:grid-cols-2 lg:content-start lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1">

              {activeItems.map((item) => (

                <button

                  key={item.key}

                  data-active-thumbnail={item.key === activeItem.key ? "true" : undefined}

                  type="button"

                  aria-label={`ดูรูปหมวด${item.zoneLabel}`}

                  className={`relative h-20 w-24 shrink-0 snap-start overflow-hidden rounded-xl border transition sm:h-24 sm:w-32 lg:h-[112px] lg:w-full lg:rounded-lg lg:border-2 ${

                    item.key === activeItem.key

                      ? "border-white opacity-100 shadow-[0_0_0_2px_rgba(255,255,255,0.22)]"

                      : "border-white/10 opacity-75 hover:border-white/35 hover:opacity-100"

                  }`}

                  onClick={() => {
                    onSelect(item);
                  }}
                >

                  {buildGalleryDisplaySrc(listing.id, item, 160, 60) ? (
                  <Image

                    src={buildGalleryDisplaySrc(listing.id, item, 160, 60) ?? ""}

                    alt={item.caption ?? item.zoneLabel}

                    fill

                    unoptimized

                    sizes="(max-width: 1024px) 120px, 150px"

                    className="object-cover"

                    loading="lazy"

                    onError={() => {
                      onImageError(item.url);
                    }}
                  />
                  ) : (
                    <div className="grid h-full place-items-center text-[var(--site-on-primary)] opacity-60">
                      <ImageOff className="h-6 w-6" />
                    </div>
                  )}

                </button>

              ))}

            </div>

          </aside>

        </div>

      </div>

    </div>

  );

}
