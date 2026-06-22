import {
  Bath,
  BedDouble,
  MapPin,
  Play,
  Users,
  Waves,
} from "lucide-react";
import { YouTubeEmbed } from "@/components/ui/youtube-embed";
import {
  getVillaSearchIntentSummary,
  getVillaTitle as getSeoVillaTitle,
} from "@/lib/seo";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { Amenity, VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { DEFAULT_AMENITY_PREVIEW_COUNT, getAmenityIcon } from "./content-amenities";
import { findSection } from "./helpers";

export function VillaIntro({

  content,

  listing,

}: {

  content: VillaDetailContent;

  listing: VillaListing;

}) {

  return (

    <section className="border-b border-[var(--site-border)] pb-6">

      <span className="rounded-full bg-[var(--site-primary-soft)] px-3 py-1 text-xs font-black text-[var(--site-primary)]">

        DV-{listing.id}

      </span>

      <h1 className="mt-3 text-[28px] font-black leading-tight text-[var(--site-text)] sm:text-4xl">

        {getSeoVillaTitle(listing)}

      </h1>

      {listing.price === null ? null : (
      <p className="mt-1 text-sm font-bold text-[var(--site-accent)]">

        เริ่มต้น {formatVillaPrice(listing.price)} / คืน

      </p>
      )}

      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--site-muted)]">
        {getVillaSearchIntentSummary(listing)}
      </p>

      <nav
        aria-label="ลิงก์ค้นหาบ้านพักที่เกี่ยวข้อง"
        className="mt-4 flex flex-wrap gap-2 text-sm font-bold"
      >
        <a
          className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
          href="/search"
        >
          ค้นหาบ้านพักเพิ่มเติม
        </a>
        <a
          className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
          href="/guides"
        >
          อ่านคู่มือก่อนจอง
        </a>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[var(--site-muted)]">

        <span className="inline-flex items-center gap-1.5">

          <MapPin className="h-4 w-4 text-[var(--site-primary)]" />

          {content.location?.address ?? listing.zoneLabel}

        </span>

        <span>ห่างทะเล {content.location?.seaDistance ?? listing.distanceToSea}</span>

        {content.location?.mapUrl ? (

          <a

            href={content.location.mapUrl}

            target="_blank"

            rel="noreferrer"

            className="font-black text-[var(--site-primary)] underline-offset-4 hover:underline"

          >

            ดูแผนที่

          </a>

        ) : null}

      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

        <StatTile icon={BedDouble} label="ห้องนอน" value={`${listing.bedrooms}`} />

        <StatTile icon={Bath} label="ห้องน้ำ" value={`${listing.bathrooms}`} />

        <StatTile icon={Users} label="ผู้เข้าพัก" value={`${listing.people} ท่าน`} />

        <StatTile icon={Waves} label="สระว่ายน้ำ" value="ส่วนตัว" />

      </div>

    </section>

  );

}

function StatTile({

  icon: Icon,

  label,

  value,

}: {

  icon: typeof Users;

  label: string;

  value: string;

}) {

  return (

    <div className="flex items-center gap-3 rounded-2xl bg-[var(--site-surface-soft)] px-4 py-3">

      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
        <Icon className="h-5 w-5" />

      </span>

      <span>

        <span className="block text-xs font-bold text-[var(--site-muted)]">{label}</span>

        <span className="block text-sm font-black text-[var(--site-text)]">{value}</span>

      </span>

    </div>

  );

}

export function AboutSection({

  content,

  listing,

}: {

  content: VillaDetailContent;

  listing: VillaListing;

}) {

  const moreDetail = findSection(content, "รายละเอียดเพิ่มเติม");

  const descriptionLines =

    moreDetail?.lines.slice(0, 4) ??

    [

      `${getSeoVillaTitle(listing)} เหมาะสำหรับครอบครัวและกลุ่มเพื่อนที่ต้องการพื้นที่พักผ่อนส่วนตัว`,

      "อัปเดตข้อมูลบ้านพักเพิ่มเติมตามข้อมูลล่าสุดอยู่ระหว่างการซิงค์ กรุณากลับมาเช็กอีกครั้งภายในสัปดาห์นี้"

    ];

  return (

    <section className="py-8">

      <div className="flex items-center gap-2">

        <h2 className="text-2xl font-black text-[var(--site-text)]">เกี่ยวกับบ้านพัก</h2>

      </div>

      <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--site-muted)]">

        {descriptionLines.map((line, index) => (

          <p key={`${index}-${line}`}>{line}</p>

        ))}

      </div>

    </section>

  );

}

interface AmenitiesSectionProps {
  amenities: Amenity[];
  compact?: boolean;
  previewCount?: number;
}

export function AmenitiesSection({
  amenities,
  compact = false,
  previewCount = DEFAULT_AMENITY_PREVIEW_COUNT,
}: AmenitiesSectionProps) {

  const shouldCompact = compact && amenities.length > previewCount;
  const visibleAmenities = shouldCompact
    ? amenities.slice(0, previewCount)
    : amenities;
  const hiddenAmenities = shouldCompact
    ? amenities.slice(previewCount)
    : [];

  return (

    <section
      className="py-6"
      data-detail-amenities-compact={shouldCompact ? "true" : undefined}
    >

      <h2 className="text-2xl font-black text-[var(--site-text)]">สิ่งอำนวยความสะดวก</h2>

      <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">

        {visibleAmenities.map((amenity) => {

          const Icon = getAmenityIcon(amenity.key);

          return (

            <div
              key={amenity.key}
              className="flex items-center gap-3 text-sm font-semibold text-[var(--site-text)]"
              data-amenity-icon={amenity.key}
            >

              <Icon className="h-4 w-4 text-[var(--site-primary)]" />

              {amenity.label}

            </div>

          );

        })}

      </div>

      {hiddenAmenities.length > 0 ? (
        <details className="mt-4 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-black text-[var(--site-primary)]">
            ดูสิ่งอำนวยความสะดวกเพิ่มอีก {hiddenAmenities.length.toLocaleString("th-TH")} รายการ
          </summary>
          <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {hiddenAmenities.map((amenity) => {
              const Icon = getAmenityIcon(amenity.key);

              return (
                <div
                  key={amenity.key}
                  className="flex items-center gap-3 text-sm font-semibold text-[var(--site-text)]"
                  data-amenity-icon={amenity.key}
                >
                  <Icon className="h-4 w-4 text-[var(--site-primary)]" />
                  {amenity.label}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

    </section>

  );

}

export function VideoReviewSection({ videos }: { videos: VillaDetailContent["videos"] }) {
  if (videos.length === 0) {

    return null;

  }

  return (

    <section className="border-t border-[var(--site-border)] py-8">

      <div className="flex items-center gap-3">

        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <Play aria-hidden="true" className="ml-1 size-7 fill-current" />

        </span>

        <h2 className="text-2xl font-black text-[var(--site-text)]">คลิปรีวิวบ้านพัก</h2>

      </div>

      <div className="mt-5 grid gap-4">

        {videos.map((video) => (

          <article

            key={video.url}

            className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_14px_38px_rgba(6,63,53,0.08)]"

          >

            {video.embedUrl ? (

              <YouTubeEmbed
                className="rounded-none border-0 shadow-none"
                embedUrl={video.embedUrl}
                title={video.label}
              />

            ) : (

              <div className="grid min-h-44 place-items-center bg-[var(--site-primary-soft)] p-6 text-center">

                <div>

                  <Play aria-hidden="true" className="ml-1 size-7 fill-current" />

                  <p className="mt-3 text-sm font-bold text-[var(--site-muted)]">

                    ลิงก์นี้ยังไม่รองรับการฝังวิดีโอในหน้าเว็บ

                  </p>

                </div>

              </div>

            )}

          </article>

        ))}

      </div>

    </section>

  );

}
