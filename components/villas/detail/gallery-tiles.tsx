import { ImageOff } from "lucide-react";
import Image from "next/image";
import { buildGalleryDisplaySrc } from "./gallery-urls";
import type { GalleryItem } from "./types";

export function GalleryImage({
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
  const displaySrc = item.url ? buildGalleryDisplaySrc(listingId, item) : null;

  return (
    <button
      type="button"
      className={`group relative block w-full overflow-hidden bg-[var(--site-surface-tint)] text-left ${className}`}
      onClick={() => {
        onClick?.(item);
      }}
    >
      {displaySrc ? (
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

export function GalleryReservedTile({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-[var(--site-surface-tint)] ${className}`}
      data-gallery-reserved-slot="true"
    />
  );
}
