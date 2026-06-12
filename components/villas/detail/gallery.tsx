import { ChevronLeft, ChevronRight, Download, ImageIcon, ImageOff, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { VillaListing } from "@/lib/villas/types";
import { getGalleryItemDescription, getVillaTitle } from "./helpers";
import type { GalleryCategory, GalleryItem } from "./types";

/**
 * Build a download URL for a gallery image under the villas images download API.
 *
 * @param listingId - The villa listing identifier to include in the request path
 * @param item - The gallery item whose `url` and optional `imageName`/`zoneKey` will be serialized as query parameters
 * @returns The API path for downloading the image, including encoded `listingId` and query parameters (`url`, and optionally `name` and `zone`)
 */
function buildGalleryDownloadHref(listingId: string, item: GalleryItem): string {
  const params = new URLSearchParams({
    url: item.url,
  });

  if (item.imageName) {
    params.set("name", item.imageName);
  }

  if (item.zoneKey) {
    params.set("zone", item.zoneKey);
  }

  return `/api/villas/${encodeURIComponent(listingId)}/images/download?${params.toString()}`;
}

function buildGalleryDisplaySrc(listingId: string, item: GalleryItem): string {
  const params = new URLSearchParams({
    url: item.url,
  });

  return `/api/villas/${encodeURIComponent(listingId)}/images/proxy?${params.toString()}`;
}

/**
 * Renders a clickable gallery image tile that displays either the provided image or a placeholder.
 *
 * The tile is a full-width button that:
 * - Shows the image when `item.url` is present, with zone label overlay.
 * - Shows a centered placeholder icon when `item.url` is falsy.
 * - Calls `onClick(item)` when the tile is clicked (if `onClick` is provided).
 * - Calls `onError(url)` when the image fails to load.
 *
 * @param alt - Alt text for the image
 * @param className - Additional CSS class names to apply to the root button
 * @param item - The gallery item to render (provides `url`, `zoneLabel`, etc.)
 * @param onClick - Optional callback invoked with `item` when the tile is clicked
 * @param onError - Callback invoked with the image `url` when the image fails to load
 * @returns The JSX element for the gallery image tile
 */
function GalleryImage({

  alt,

  className = "",

  item,

  listingId,

  onClick,

  onError,

  fetchPriority,

  loading = "lazy",

}: {

  alt: string;

  className?: string;

  item: GalleryItem;

  listingId: string;

  onClick?: (item: GalleryItem) => void;

  onError: (url: string) => void;

  fetchPriority?: "auto" | "high" | "low";

  loading?: "eager" | "lazy";

}) {
  const displaySrc = item.url ? buildGalleryDisplaySrc(listingId, item) : "";

  return (

    <button

      type="button"

      className={`group relative block w-full overflow-hidden bg-[var(--site-surface-tint)] text-left ${className}`}

      onClick={() => {
        onClick?.(item);
      }}
    >

      {item.url ? (

        <>

          <Image

            src={displaySrc}

            alt={alt}

            fill

            loading={loading}

            fetchPriority={fetchPriority}

            unoptimized

            sizes="(max-width: 1024px) 100vw, 50vw"

            className="object-cover transition duration-500 group-hover:scale-[1.03]"

            onError={() => {
              onError(item.url);
            }}
          />

          <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-black text-[var(--site-on-primary)] opacity-0 backdrop-blur transition group-hover:opacity-100">

            {item.zoneLabel}

          </span>

        </>

      ) : (

        <div className="grid h-full place-items-center text-[var(--site-muted)]">

          <ImageOff className="h-8 w-8" />

        </div>

      )}

    </button>

  );

}

/**
 * Renders a "view all" gallery tile that displays an image preview (when available) and an overlay showing the total additional image count.
 *
 * @param item - The gallery item used to render the tile (image URL, labels, etc.)
 * @param onClick - Callback invoked with `item` when the tile is activated
 * @param onError - Callback invoked with the image URL when the image fails to load
 * @param totalImageCount - The total number of images displayed in the overlay (shown as "+ {n} รูป")
 * @returns A JSX element representing the tiled button used to open or view all gallery images
 */
function GalleryViewAllTile({

  item,

  listingId,

  onClick,

  onError,

  totalImageCount,

}: {

  item: GalleryItem;

  listingId: string;

  onClick: (item: GalleryItem) => void;

  onError: (url: string) => void;

  totalImageCount: number;

}) {

  return (

    <button

      type="button"

      className="group relative block aspect-[4/3] w-full overflow-hidden bg-[var(--site-primary-hover)] text-[var(--site-on-primary)] lg:h-full"
      onClick={() => {
        onClick(item);
      }}
    >

      {item.url ? (

        <Image

          src={buildGalleryDisplaySrc(listingId, item)}

          alt=""

          fill

          loading="lazy"

          unoptimized

          sizes="(max-width: 1024px) 33vw, 50vw"

          className="scale-110 object-cover blur-md brightness-50 transition duration-500 group-hover:scale-[1.15]"

          onError={() => {
            onError(item.url);
          }}
        />

      ) : null}

      <span className="absolute inset-0 bg-black/25" />

      <span className="absolute inset-0 grid place-items-center text-[11px] font-black lg:text-lg">

        <span className="inline-flex max-w-[92%] items-center gap-1 rounded-full bg-black/45 px-3 py-2 backdrop-blur-md lg:gap-2 lg:px-5">

          <ImageIcon className="h-4 w-4 lg:h-5 lg:w-5" />

              <span>+ {totalImageCount} รูป</span>

        </span>

      </span>

    </button>

  );

}

void GalleryViewAllTile;



/**
 * Renders a responsive image gallery grid for a villa listing with up to four visible tiles.
 *
 * The first four entries of `items` are used as the main, second, third, and fourth tiles.
 * Each tile calls `onImageClick` when activated and reports image load failures via `onImageError`.
 * The fourth tile (when present) displays an overlay showing `+ {totalImageCount} รูป`.
 *
 * @param items - Gallery items; the first four elements map to the visible tiles (main, second, third, fourth)
 * @param listing - Villa listing used to build image alt text and titles
 * @param onImageClick - Callback invoked with the clicked `GalleryItem`
 * @param onImageError - Callback invoked with the image `url` when an image fails to load
 * @param totalImageCount - Total number of images in the gallery, shown on the fourth-tile overlay as `+ {n} รูป`
 */
export function Gallery({

  items,

  listing,

  onImageClick,

  onImageError,

  totalImageCount,

}: {

  items: GalleryItem[];

  listing: VillaListing;

  onImageClick: (item: GalleryItem) => void;

  onImageError: (url: string) => void;

  totalImageCount: number;

}) {

  const [main, second, third, fourth] = items;

  return (

    <section className="mx-auto w-full max-w-7xl px-0 sm:px-6 lg:px-8">

      <div className="grid w-full gap-2 bg-transparent lg:h-[500px] lg:grid-cols-[3fr_2fr] lg:gap-1 lg:overflow-hidden lg:rounded-xl">

      <GalleryImage

        alt={`${getVillaTitle(listing.id)} รูปหลัก`}

        className="aspect-[16/11] rounded-none sm:rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-xl lg:rounded-r-none"

        item={main}

        listingId={listing.id}

        fetchPriority="high"

        loading="eager"

        onClick={onImageClick}

        onError={onImageError}

      />

      <div className="mx-auto grid w-[calc(100%_-_45px)] grid-cols-3 gap-2 sm:w-full lg:h-full lg:grid-cols-2 lg:grid-rows-2 lg:gap-1">

        {second ? (

        <GalleryImage

          alt={`${getVillaTitle(listing.id)} ห้องนั่งเล่น`}

          className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-none"

          item={second}

          listingId={listing.id}

          onClick={onImageClick}

          onError={onImageError}

        />

        ) : null}

        {third ? (

        <GalleryImage

          alt={`${getVillaTitle(listing.id)} ห้องนอน`}

          className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-none lg:rounded-r-xl lg:rounded-bl-none"

          item={third}

          listingId={listing.id}

          onClick={onImageClick}

          onError={onImageError}

        />

        ) : null}

        {fourth ? (

        <div className="relative overflow-hidden rounded-2xl lg:col-span-2 lg:h-full lg:rounded-br-xl lg:rounded-t-none [&>button]:h-full [&>button]:w-full [&>button]:rounded-none">

          <GalleryImage

            alt={`${getVillaTitle(listing.id)} รวมรูปบ้านพัก`}

            className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:rounded-none [&_img]:scale-110 [&_img]:brightness-75"

        item={fourth}

        listingId={listing.id}

        onClick={onImageClick}

        onError={onImageError}

        loading="lazy"

          />

          <button

            type="button"

            className="absolute inset-0 grid place-items-center bg-black/5 text-[11px] font-black text-[var(--site-on-primary)] lg:text-sm"

            onClick={() => {
              onImageClick(fourth);
            }}
          >

            <span className="inline-flex max-w-[92%] items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-md lg:gap-2 lg:px-4 lg:py-2">

              {/* <ImageIcon className="h-4 w-4" /> */}

              <span>+ {totalImageCount} รูป</span>

            </span>

          </button>

        </div>

        ) : null}

      </div>

      </div>

    </section>

  );

}

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
  const isActiveImageLoading = loadedImageKey !== activeItem.key;
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
            <Image

              key={activeItem.key}

              src={buildGalleryDisplaySrc(listing.id, activeItem)}

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

                  <Image

                    src={buildGalleryDisplaySrc(listing.id, item)}

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

                </button>

              ))}

            </div>

          </aside>

        </div>

      </div>

    </div>

  );

}
