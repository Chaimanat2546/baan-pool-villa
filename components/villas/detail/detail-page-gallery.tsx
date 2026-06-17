import { ImageOff } from "lucide-react";
import type { VillaListing } from "@/lib/villas/types";
import { Gallery } from "./gallery";
import { GallerySkeleton } from "./gallery-skeleton";
import type { GalleryItem } from "./types";

interface VillaDetailGalleryProps {
  items: GalleryItem[];
  listing: VillaListing;
  onImageClick: (item: GalleryItem) => void;
  onImageError: (imageUrl: string) => void;
  onRetry: () => void;
  showSkeleton: boolean;
  totalImageCount: number;
}

export function VillaDetailGallery({
  items,
  listing,
  onImageClick,
  onImageError,
  onRetry,
  showSkeleton,
  totalImageCount,
}: VillaDetailGalleryProps) {
  if (showSkeleton) {
    return <GallerySkeleton />;
  }

  if (items.length > 0) {
    return (
      <Gallery
        items={items}
        listing={listing}
        onImageClick={onImageClick}
        onImageError={onImageError}
        totalImageCount={totalImageCount}
      />
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid aspect-[16/7] place-items-center rounded-2xl bg-[var(--site-surface-tint)] text-[var(--site-muted)]">
        <div className="flex flex-col items-center gap-3">
          <ImageOff className="h-10 w-10" />
          <button
            className="rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-black text-[var(--site-on-primary)]"
            data-gallery-retry="true"
            type="button"
            onClick={onRetry}
          >
            โหลดรูปอีกครั้ง
          </button>
        </div>
      </div>
    </section>
  );
}

export function VillaDetailGalleryError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error === null) {
    return null;
  }

  return (
    <section className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3 text-sm font-bold text-[var(--site-muted)]"
        data-gallery-load-status="error"
      >
        <span>{error}</span>
        <button
          className="rounded-full bg-[var(--site-primary)] px-3 py-1.5 text-xs font-black text-[var(--site-on-primary)]"
          data-gallery-retry="true"
          type="button"
          onClick={onRetry}
        >
          ลองใหม่
        </button>
      </div>
    </section>
  );
}
