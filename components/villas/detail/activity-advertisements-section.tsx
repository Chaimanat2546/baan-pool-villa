"use client";

import { ImageIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import { DETAIL_LAYOUT_BLOCK_LABELS } from "@/lib/detail-layout/defaults";
import { buildAwsImageUrl } from "@/lib/aws-image-url";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";
import { GalleryLightbox } from "./gallery";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { useAdvertisementRail } from "./use-advertisement-rail";
import styles from "./activity-advertisements-section.module.css";
import type { GalleryCategory, GalleryItem } from "./types";

const ADVERTISEMENTS_PER_SLIDE = 3;

function getAdvertisementImageUrls(advertisement: PublicAdvertisement) {
  return advertisement.imageUrls?.length
    ? advertisement.imageUrls
    : [advertisement.imageUrl];
}

function toActivityItem(
  advertisement: PublicAdvertisement,
  imageUrl: string,
  index: number,
): GalleryItem {
  return {
    caption: advertisement.title,
    imageName: null,
    isCover: false,
    isMock: false,
    key: `activity-${advertisement.id}-${index}`,
    url: imageUrl,
    zone: advertisement.id,
    zoneKey: `activity-${advertisement.id}`,
    zoneLabel: advertisement.title,
  };
}

export function ActivityAdvertisementsSection({
  advertisements,
  nextCursor = null,
  galleryStyle,
  listing,
  title = DETAIL_LAYOUT_BLOCK_LABELS.advertisements,
}: {
  advertisements: PublicAdvertisement[];
  nextCursor?: string | null;
  galleryStyle: GalleryStyleSettings;
  listing: VillaListing;
  title?: string;
}) {
  const rail = useAdvertisementRail(advertisements, nextCursor, listing.zone);
  const [activeAdvertisement, setActiveAdvertisement] =
    useState<PublicAdvertisement | null>(null);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleAdvertisements = useMemo(
    () =>
      rail.items
        .map((advertisement) => ({
          advertisement,
          imageUrls: getAdvertisementImageUrls(advertisement).filter(
            (imageUrl) => !failedImageUrls.has(imageUrl),
          ),
        }))
        .filter(({ imageUrls }) => imageUrls.length > 0),
    [rail.items, failedImageUrls],
  );
  const slides = useMemo(() => Array.from(
    { length: Math.ceil(visibleAdvertisements.length / ADVERTISEMENTS_PER_SLIDE) },
    (_, index) => visibleAdvertisements.slice(index * ADVERTISEMENTS_PER_SLIDE, (index + 1) * ADVERTISEMENTS_PER_SLIDE),
  ), [visibleAdvertisements]);
  const { onActiveIndexChange } = rail;
  const handleActiveIndexChange = useCallback((index: number) => {
    onActiveIndexChange(index * ADVERTISEMENTS_PER_SLIDE, visibleAdvertisements.map(item => item.advertisement));
  }, [onActiveIndexChange, visibleAdvertisements]);
  const activeItems = useMemo(
    () =>
      activeAdvertisement
        ? getAdvertisementImageUrls(activeAdvertisement)
            .filter((imageUrl) => !failedImageUrls.has(imageUrl))
            .map((imageUrl, index) =>
              toActivityItem(activeAdvertisement, imageUrl, index),
            )
        : [],
    [activeAdvertisement, failedImageUrls],
  );
  const categories: GalleryCategory[] = useMemo(
    () =>
      activeAdvertisement
        ? [
            {
              items: activeItems,
              key: `activity-${activeAdvertisement.id}`,
              label: activeAdvertisement.title,
            },
          ]
        : [],
    [activeAdvertisement, activeItems],
  );

  const handleImageError = (url: string) => {
    setFailedImageUrls((currentUrls) => {
      if (currentUrls.has(url)) {
        return currentUrls;
      }

      const nextUrls = new Set(currentUrls);
      nextUrls.add(url);
      return nextUrls;
    });
    setActiveItem((currentItem) =>
      currentItem?.url === url ? null : currentItem,
    );
  };

  if (visibleAdvertisements.length === 0 && !rail.cursor) {
    return null;
  }

  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]"
      data-detail-advertisements-section="true"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <ImageIcon className="h-5 w-5" />
        </span>
        <h2 className="min-w-0 break-words text-xl font-black text-[var(--site-text)]">
          {title.trim() || DETAIL_LAYOUT_BLOCK_LABELS.advertisements}
        </h2>
      </div>

      <div className={styles.rail}>
      <ScrollRail label="โฆษณา" controlsPosition="bottom" alwaysShowControls={slides.length > 1} className="mt-5 py-1" onActiveIndexChange={handleActiveIndexChange}>
        {slides.map(slide => <div key={slide[0].advertisement.id} className={styles.column}>
        {slide.map(({ advertisement, imageUrls }) => (
          <button
            className={`${styles.card} group flex gap-3 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 text-left shadow-[0_10px_30px_rgba(6,63,53,0.06)] transition hover:border-[var(--site-border-strong)] hover:shadow-[0_16px_34px_rgba(6,63,53,0.11)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]`}
            data-detail-advertisement-card="true"
            key={advertisement.id}
            onClick={() => {
              setActiveAdvertisement(advertisement);
              setActiveItem(toActivityItem(advertisement, imageUrls[0], 0));
            }}
            type="button"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--site-surface-tint)] sm:h-24 sm:w-28">
              {rail.activeIds.has(advertisement.id) ? <Image
                alt={advertisement.title}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                fill
                onError={() => {
                  handleImageError(imageUrls[0]);
                }}
                quality={60}
                sizes="(max-width: 639px) 80px, 112px"
                src={imageUrls[0]}
              /> : <ImageIcon aria-hidden="true" className="absolute inset-0 m-auto size-8 text-[var(--site-muted)]" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 self-stretch py-1">
              <h3 className="line-clamp-2 text-sm font-black leading-5 text-[var(--site-text)] sm:text-base sm:leading-6">
                {advertisement.title}
              </h3>
              <span className="inline-flex w-fit max-w-full items-center self-end rounded-full bg-[var(--site-primary)] px-3 py-2 text-xs font-black text-[var(--site-header-link)] transition group-hover:opacity-90 sm:text-sm">
                ดูรูปกิจกรรม
              </span>
            </div>
          </button>
        ))}
        </div>)}
      </ScrollRail>
      {rail.cursor && <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--site-muted)]">
        {rail.loading ? <span role="status">กำลังโหลดโฆษณา…</span> : <>
          {rail.error && <span role="alert">โหลดโฆษณาเพิ่มเติมไม่สำเร็จ</span>}
          <button type="button" onClick={() => void rail.loadMore()} className="min-h-11 rounded px-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]">{rail.error ? "ลองใหม่" : "ดูโฆษณาเพิ่มเติม"}</button>
        </>}
      </div>}
      </div>

      <GalleryLightbox
        activeItem={activeItem}
        categories={categories}
        eyebrow="แกลเลอรีกิจกรรม"
        getImageSrc={(item, width, quality) => buildAwsImageUrl({ src: item.url, width, quality })}
        listing={listing}
        onClose={() => {
          setActiveItem(null);
        }}
        onImageError={handleImageError}
        onSelect={setActiveItem}
        showCategorySelector={false}
        showDownload={false}
        style={galleryStyle}
        title={activeAdvertisement?.title ?? "กิจกรรม"}
      />
    </section>
  );
}
