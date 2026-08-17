"use client";

import { ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";
import { GalleryLightbox } from "./gallery";
import type { GalleryCategory, GalleryItem } from "./types";

const DETAIL_ACTIVITY_LIMIT = 3;

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
  galleryStyle,
  listing,
}: {
  advertisements: PublicAdvertisement[];
  galleryStyle: GalleryStyleSettings;
  listing: VillaListing;
}) {
  const [activeAdvertisement, setActiveAdvertisement] =
    useState<PublicAdvertisement | null>(null);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleAdvertisements = useMemo(
    () =>
      advertisements
        .slice(0, DETAIL_ACTIVITY_LIMIT)
        .map((advertisement) => ({
          advertisement,
          imageUrls: getAdvertisementImageUrls(advertisement).filter(
            (imageUrl) => !failedImageUrls.has(imageUrl),
          ),
        }))
        .filter(({ imageUrls }) => imageUrls.length > 0),
    [advertisements, failedImageUrls],
  );
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

  if (visibleAdvertisements.length === 0) {
    return null;
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]"
      data-detail-advertisements-section="true"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <ImageIcon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-black text-[var(--site-text)]">
          กิจกรรมที่น่าสนใจ
        </h2>
      </div>

      <div className="mt-5 max-h-[292px] space-y-3 overflow-y-auto overflow-x-hidden pr-2">
        {visibleAdvertisements.map(({ advertisement, imageUrls }) => (
          <button
            className="group flex w-full min-w-0 gap-3 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 text-left shadow-[0_10px_30px_rgba(6,63,53,0.06)] transition hover:-translate-y-0.5 hover:border-[var(--site-border-strong)] hover:shadow-[0_16px_34px_rgba(6,63,53,0.11)]"
            data-detail-advertisement-card="true"
            key={advertisement.id}
            onClick={() => {
              setActiveAdvertisement(advertisement);
              setActiveItem(toActivityItem(advertisement, imageUrls[0], 0));
            }}
            type="button"
          >
            <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--site-surface-tint)]">
              <Image
                alt={advertisement.title}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                fill
                onError={() => {
                  handleImageError(imageUrls[0]);
                }}
                quality={60}
                sizes="112px"
                src={imageUrls[0]}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 self-stretch py-1">
              <h3 className="line-clamp-2 text-base font-black leading-6 text-[var(--site-text)]">
                {advertisement.title}
              </h3>
              <span className="inline-flex w-fit items-center self-end rounded-full bg-[var(--site-primary)] px-3 py-2 text-sm font-black text-[var(--site-header-link)] transition group-hover:opacity-90">
                ดูรูปกิจกรรม
              </span>
            </div>
          </button>
        ))}
      </div>

      <GalleryLightbox
        activeItem={activeItem}
        categories={categories}
        eyebrow="แกลเลอรีกิจกรรม"
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
