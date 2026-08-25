import type { VillaListing } from "@/lib/villas/types";
import { GalleryImage, GalleryReservedTile } from "./gallery-tiles";
import { getVillaTitle } from "./helpers";
import type { GalleryItem } from "./types";

export function Gallery({
  items,
  listing,
  onImageClick,
  onImageError,
  onViewAll,
  totalImageCount,
}: {
  items: GalleryItem[];
  listing: VillaListing;
  onImageClick: (item: GalleryItem) => void;
  onImageError: (url: string) => void;
  onViewAll: () => void;
  totalImageCount: number | null;
}) {
  const [main, second, third, fourth] = items;

  if (!main) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-0 sm:px-6 lg:px-8">
      <div className="grid w-full gap-2 bg-transparent lg:h-[500px] lg:grid-cols-[3fr_2fr] lg:gap-1 lg:overflow-hidden lg:rounded-xl">
        <GalleryImage
          alt={`${getVillaTitle(listing.id, listing.title)} รูปหลัก`}
          className="aspect-[16/11] rounded-none sm:rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-xl lg:rounded-r-none"
          fetchPriority="high"
          item={main}
          listingId={listing.id}
          loading="eager"
          onClick={onImageClick}
          onError={onImageError}
          sizes="(max-width: 1023px) 100vw, 60vw"
        />

        <div className="mx-auto grid w-[calc(100%_-_45px)] grid-cols-3 gap-2 sm:w-full lg:h-full lg:grid-cols-2 lg:grid-rows-2 lg:gap-1">
          {second ? (
            <GalleryImage
              alt={`${getVillaTitle(listing.id, listing.title)} ห้องนั่งเล่น`}
              className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-none"
              item={second}
              listingId={listing.id}
              onClick={onImageClick}
              onError={onImageError}
            />
          ) : (
            <GalleryReservedTile className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-none" />
          )}

          {third ? (
            <GalleryImage
              alt={`${getVillaTitle(listing.id, listing.title)} ห้องนอน`}
              className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-none lg:rounded-r-xl lg:rounded-bl-none"
              item={third}
              listingId={listing.id}
              onClick={onImageClick}
              onError={onImageError}
            />
          ) : (
            <GalleryReservedTile className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-none lg:rounded-r-xl lg:rounded-bl-none" />
          )}

          {fourth ? (
            <div className="relative overflow-hidden rounded-2xl lg:col-span-2 lg:h-full lg:rounded-br-xl lg:rounded-t-none [&>button]:h-full [&>button]:w-full [&>button]:rounded-none">
              <GalleryImage
                alt={`${getVillaTitle(listing.id, listing.title)} รวมรูปบ้านพัก`}
                className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:rounded-none [&_img]:scale-110 [&_img]:brightness-75"
                item={fourth}
                listingId={listing.id}
                loading="lazy"
                onClick={onImageClick}
                onError={onImageError}
              />

              <button
                className="absolute inset-0 grid place-items-center bg-black/5 text-[11px] font-black text-[var(--site-on-overlay)] lg:text-sm"
                type="button"
                onClick={() => {
                  onViewAll();
                }}
              >
                <span className="inline-flex max-w-[92%] items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-md lg:gap-2 lg:px-4 lg:py-2">
                  <span>
                    ดูรูปที่พัก
                    {totalImageCount === null ? "" : ` (${totalImageCount})`}
                  </span>
                </span>
              </button>
            </div>
          ) : (
            <GalleryReservedTile className="aspect-[4/3] rounded-2xl lg:col-span-2 lg:aspect-auto lg:h-full lg:rounded-br-xl lg:rounded-t-none" />
          )}
        </div>
      </div>
    </section>
  );
}

export { GalleryLightbox } from "./gallery-lightbox";
