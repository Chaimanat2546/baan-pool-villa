"use client";

import { BedDouble, MapPin, Users } from "lucide-react";
import { ImageWithSkeleton as Image } from "@/components/ui/image-with-skeleton";

import { normalizePublicVillaCoverImage } from "@/lib/villas/public-dto";
import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";
import { VillaCardGalleryImages } from "./villa-card-gallery-images";
import { useVillaCardStyle } from "./villa-card-style-context";

interface VillaCardProps {
  coverImageSrcOverride?: string | null;
  galleryImageUrls?: string[];
  navigationMode?: "link" | "static";
  villaCardStyle?: SiteVillaCardStyle;
  villa: VillaListing;
  titleHeadingLevel?: "h2" | "h3";
  preload?: boolean;
}

function getVillaTitle(villa: VillaListing): string {
  return villa.title?.trim() || `พูลวิลล่า ${villa.id}`;
}

const CARD_AMENITY_LABEL_MAX_LENGTH = 12;
const CARD_AMENITIES_CLASS = "min-h-[64px] pb-3";

function formatPrice(price: number | null): string {
  return price === null ? "" : price.toLocaleString("th-TH");
}

function isShortCardAmenityLabel(label: string): boolean {
  return Array.from(label.trim()).length <= CARD_AMENITY_LABEL_MAX_LENGTH;
}

function NoVillaCardImagePlaceholder() {
  return (
    <div className="grid h-full place-items-center bg-[var(--site-surface-tint)] text-sm font-semibold text-[var(--site-muted)]">
      ไม่มีรูปภาพ
    </div>
  );
}

export function VillaCard({
  coverImageSrcOverride,
  galleryImageUrls,
  navigationMode = "link",
  villaCardStyle: villaCardStyleProp,
  villa,
  titleHeadingLevel = "h2",
  preload = false,
}: VillaCardProps) {
  const visibleAmenities = villa.amenities
    .filter(
      (amenity) =>
        amenity.key !== "wifi" && isShortCardAmenityLabel(amenity.label),
    )
    .slice(0, 6);
  const TitleTag = titleHeadingLevel;
  const coverImageSrc =
    coverImageSrcOverride === undefined
      ? normalizePublicVillaCoverImage(villa)
      : coverImageSrcOverride;
  const contextVillaCardStyle = useVillaCardStyle();
  const villaCardStyle = villaCardStyleProp ?? contextVillaCardStyle;
  const villaHref = `/villas/${villa.id}`;
  const villaTitle = getVillaTitle(villa);
  const isStaticNavigation = navigationMode === "static";
  const coverImageContent = coverImageSrc ? (
    <Image
      src={coverImageSrc}
      alt={villaTitle}
      fill
      preload={preload}
      quality={60}
      sizes="(max-width: 640px) 290px, (max-width: 1024px) 50vw, 325px"
      className="object-cover transition duration-500 group-hover:scale-105"
    />
  ) : (
    <NoVillaCardImagePlaceholder />
  );

  return (
    <article
      className="group block overflow-hidden rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-px shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:border-[var(--site-border-strong)] hover:shadow-[0_18px_28px_-8px_rgba(15,47,53,0.18)]"
      data-villa-card-style={villaCardStyle}
    >
      {villaCardStyle === "gallery" ? (
        <VillaCardGalleryImages
          alt={villaTitle}
          coverImageSrc={coverImageSrc}
          href={isStaticNavigation ? undefined : villaHref}
          initialImageUrls={galleryImageUrls ? undefined : villa.galleryPreviewImages}
          preload={preload}
          staticImageUrls={galleryImageUrls}
          villaId={villa.id}
        />
      ) : isStaticNavigation ? (
        <div
          aria-label={villaTitle}
          className="relative block h-[216px] w-full overflow-hidden rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]"
        >
          {coverImageContent}
        </div>
      ) : (
        <a
          aria-label={villaTitle}
          className="relative block h-[216px] w-full overflow-hidden rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]"
          href={villaHref}
        >
          {coverImageContent}
        </a>
      )}

      <div className="p-3">
        <div className="flex min-w-0 items-start justify-between gap-3 pb-2">
          <TitleTag className="min-w-0 truncate text-lg font-semibold leading-7">
            {isStaticNavigation ? (
              <span className="text-[var(--site-text)]">{villaTitle}</span>
            ) : (
              <a
                className="text-[var(--site-text)] transition hover:text-[var(--site-primary)]"
                href={villaHref}
              >
                {villaTitle}
              </a>
            )}
          </TitleTag>
          <span className="flex shrink-0 items-center gap-1 pt-1 text-sm leading-5 text-[var(--site-muted)]">
            <MapPin className="h-4 w-4" />
            <span className="max-w-[96px] truncate">{villa.zoneLabel}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 text-xs leading-4 text-[var(--site-muted)]">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-[var(--site-primary)]" />
            {villa.bedrooms.toLocaleString("th-TH")} ห้องนอน
          </span>
          <span className="text-sm leading-5 text-[var(--site-muted)]">•</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[var(--site-primary)]" />
            รองรับ {villa.people.toLocaleString("th-TH")} คน
          </span>
        </div>

        {visibleAmenities.length > 0 ? (
          <div className={`flex ${CARD_AMENITIES_CLASS} flex-wrap content-start gap-1`}>
            {visibleAmenities.map((amenity) => (
              <span
                key={amenity.key}
                className="block truncate rounded-full bg-[var(--site-accent-soft)] px-3 py-1 text-xs font-semibold leading-4 text-[var(--site-text)]"
              >
                {amenity.label}
              </span>
            ))}
          </div>
        ) : villa.amenities.length === 0 ? (
          <div className={`${CARD_AMENITIES_CLASS} text-xs leading-5 text-[var(--site-muted)]`}>
            ไม่มีข้อมูลสิ่งอำนวยความสะดวก
          </div>
        ) : (
          <div className={CARD_AMENITIES_CLASS} aria-hidden="true" />
        )}
        <div className="flex items-end justify-between gap-3">
          <p className={villa.price === null ? "hidden" : "min-w-0 text-[var(--site-text)]"}>
            <span className="text-sm leading-5">เริ่มต้น</span>{" "}
            <span className="text-lg leading-7">{formatPrice(villa.price)}</span>{" "}
            <span className="text-sm leading-5">บาท / คืน</span>
          </p>
        </div>
      </div>
    </article>
  );
}
