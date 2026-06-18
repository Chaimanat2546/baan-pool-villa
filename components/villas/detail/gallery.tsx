import type { VillaListing } from "@/lib/villas/types";
import { GalleryImage, GalleryReservedTile } from "./gallery-tiles";
import { getVillaTitle } from "./helpers";
import type { GalleryItem } from "./types";

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

  if (!main) {
    return null;
  }

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

        ) : (
          <GalleryReservedTile className="aspect-[4/3] rounded-2xl lg:aspect-auto lg:h-full lg:rounded-none" />
        )}

        {third ? (

        <GalleryImage

          alt={`${getVillaTitle(listing.id)} ห้องนอน`}

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

        ) : (
          <GalleryReservedTile className="aspect-[4/3] rounded-2xl lg:col-span-2 lg:aspect-auto lg:h-full lg:rounded-br-xl lg:rounded-t-none" />
        )}

      </div>

      </div>

    </section>

  );

}

export { GalleryLightbox } from "./gallery-lightbox";
