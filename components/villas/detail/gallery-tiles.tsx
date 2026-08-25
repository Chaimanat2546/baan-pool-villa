import { ImageOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { buildGalleryDisplaySrc } from "./gallery-urls";
import type { GalleryItem } from "./types";

interface GalleryImageProps {
  alt: string;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
  item: GalleryItem;
  listingId: string;
  loading?: "eager" | "lazy";
  onClick?: (item: GalleryItem) => void;
  onError: (url: string) => void;
  sizes?: string;
}

export function GalleryImage({
  alt,
  className = "",
  item,
  listingId,
  onClick,
  onError,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  fetchPriority,
  loading = "lazy",
}: GalleryImageProps) {
  const displaySrc = item.url ? buildGalleryDisplaySrc(listingId, item) : null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reportedBrokenSrcRef = useRef<string | null>(null);

  const reportImageError = () => {
    if (!displaySrc || reportedBrokenSrcRef.current === displaySrc) {
      return;
    }

    reportedBrokenSrcRef.current = displaySrc;
    onError(item.url);
  };

  useEffect(() => {
    if (!displaySrc) {
      reportedBrokenSrcRef.current = null;
      return;
    }

    const checkLoadedImage = () => {
      const image = buttonRef.current?.querySelector("img");

      if (image?.complete && image.naturalWidth === 0) {
        reportImageError();
      }
    };

    checkLoadedImage();

    const timeout = globalThis.setTimeout(checkLoadedImage, 1000);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  });

  return (
    <button
      ref={buttonRef}
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
            sizes={sizes}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={() => {
              reportImageError();
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
