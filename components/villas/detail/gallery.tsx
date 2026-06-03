import { ChevronLeft, ChevronRight, ImageIcon, ImageOff, X } from "lucide-react";
import Image from "next/image";
import type { VillaListing } from "@/lib/villas/types";
import { getGalleryItemDescription, getVillaTitle, shouldBypassImageOptimizer } from "./helpers";
import { MockBadge } from "./shared";
import type { GalleryCategory, GalleryItem } from "./types";

function GalleryImage({

  alt,

  className = "",

  item,

  onClick,

  onError,

}: {

  alt: string;

  className?: string;

  item: GalleryItem;

  onClick?: (item: GalleryItem) => void;

  onError: (url: string) => void;

}) {

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

            src={item.url}

            alt={alt}

            fill

            loading="eager"

            unoptimized={shouldBypassImageOptimizer(item.url)}

            sizes="(max-width: 1024px) 100vw, 50vw"

            className="object-cover transition duration-500 group-hover:scale-[1.03]"

            onError={() => {
              onError(item.url);
            }}
          />

          {item.isMock ? <MockBadge className="absolute left-3 top-3" /> : null}

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

function GalleryViewAllTile({

  item,

  onClick,

  onError,

  totalImageCount,

}: {

  item: GalleryItem;

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

          src={item.url}

          alt=""

          fill

          loading="eager"

          unoptimized={shouldBypassImageOptimizer(item.url)}

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

              <span>ดูอีก {totalImageCount} รูป</span>

        </span>

      </span>

    </button>

  );

}

void GalleryViewAllTile;



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

        onClick={onImageClick}

        onError={onImageError}

      />

      <div className="mx-auto grid w-[calc(100%_-_45px)] grid-cols-3 gap-2 sm:w-full lg:h-full lg:grid-cols-2 lg:grid-rows-2 lg:gap-1">

        {second ? (

        <GalleryImage

          alt={`${getVillaTitle(listing.id)} ห้องนั่งเล่น`}

          className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-none"

          item={second}

          onClick={onImageClick}

          onError={onImageError}

        />

        ) : null}

        {third ? (

        <GalleryImage

          alt={`${getVillaTitle(listing.id)} ห้องนอน`}

          className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-none lg:rounded-r-xl lg:rounded-bl-none"

          item={third}

          onClick={onImageClick}

          onError={onImageError}

        />

        ) : null}

        {fourth ? (

        <div className="relative overflow-hidden rounded-2xl lg:col-span-2 lg:h-full lg:rounded-br-xl lg:rounded-t-none [&>button]:h-full [&>button]:w-full [&>button]:rounded-none">

          <GalleryImage

            alt={`${getVillaTitle(listing.id)} รวมรูปบ้านพัก`}

            className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:rounded-none [&_img]:scale-110 [&_img]:blur-md [&_img]:brightness-75"

            item={fourth}

            onClick={onImageClick}

            onError={onImageError}

          />

          <button

            type="button"

            className="absolute inset-0 grid place-items-center bg-black/20 text-[11px] font-black text-[var(--site-on-primary)] lg:text-sm"

            onClick={() => {
              onImageClick(fourth);
            }}
          >

            <span className="inline-flex max-w-[92%] items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-md lg:gap-2 lg:px-4 lg:py-2">

              <ImageIcon className="h-4 w-4" />

              <span>ดูอีก {totalImageCount} รูป</span>

              {items.some((item) => item.isMock) ? (

                <MockBadge className="hidden sm:inline-flex" />

              ) : null}

            </span>

          </button>

        </div>

        ) : null}

      </div>

      </div>

    </section>

  );

}

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

  return (

    <div className="fixed inset-0 z-[70] bg-[var(--site-primary-hover)] text-[var(--site-on-primary)]">
      <div className="flex h-dvh flex-col">

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

        <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6">

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

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:overflow-hidden">

          <div className="relative h-[52dvh] min-h-[260px] min-w-0 max-w-full overflow-hidden rounded-2xl bg-white/5 sm:h-[58dvh] lg:h-auto lg:min-h-0">
            <Image

              src={activeItem.url}

              alt={`${getVillaTitle(listing.id)} ${activeItem.zoneLabel}`}

              fill

              priority

              unoptimized={shouldBypassImageOptimizer(activeItem.url)}

              sizes="100vw"

              className="object-contain"

              onError={() => {
                onImageError(activeItem.url);
              }}
            />

            {activeItems.length > 1 ? (

              <>

                <button

                  type="button"

                  aria-label="รูปก่อนหน้า"

                  className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[var(--site-on-primary)] backdrop-blur transition hover:bg-black/60 sm:left-3 sm:h-11 sm:w-11"

                  onClick={() => {
                    onSelect(previousItem);
                  }}
                >

                  <ChevronLeft className="h-5 w-5" />

                </button>

                <button

                  type="button"

                  aria-label="รูปถัดไป"

                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[var(--site-on-primary)] backdrop-blur transition hover:bg-black/60 sm:right-3 sm:h-11 sm:w-11"

                  onClick={() => {
                    onSelect(nextItem);
                  }}
                >

                  <ChevronRight className="h-5 w-5" />

                </button>

              </>

            ) : null}

          </div>

          <aside className="min-h-0 min-w-0 max-w-full lg:overflow-y-auto">

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black text-[var(--site-on-primary)] opacity-60">หมวดรูป</p>
              <h3 className="mt-1 text-xl font-black">{activeItem.zoneLabel}</h3>

              <p className="mt-2 text-sm leading-6 text-[var(--site-on-primary)] opacity-70">
                {getGalleryItemDescription(activeItem)}

              </p>

            </div>

            <div className="mt-3 flex max-w-full snap-x gap-2 overflow-x-auto overflow-y-hidden pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">

              {activeItems.map((item) => (

                <button

                  key={item.key}

                  type="button"

                  aria-label={`ดูรูปหมวด${item.zoneLabel}`}

                  className={`relative h-20 w-24 shrink-0 snap-start overflow-hidden rounded-xl border transition sm:h-24 sm:w-32 lg:h-24 lg:w-auto ${

                    item.key === activeItem.key

                      ? "border-white"

                      : "border-white/10 opacity-70 hover:opacity-100"

                  }`}

                  onClick={() => {
                    onSelect(item);
                  }}
                >

                  <Image

                    src={item.url}

                    alt={item.caption ?? item.zoneLabel}

                    fill

                    unoptimized={shouldBypassImageOptimizer(item.url)}

                    sizes="120px"

                    className="object-cover"

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
