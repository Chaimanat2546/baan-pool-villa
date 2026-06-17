import {
  ArrowRight,
  Bath,
  BedDouble,
  Car,
  Check,
  Clock,
  MapPin,
  PawPrint,
  Play,
  ShieldCheck,
  Users,
  Waves,
} from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import {
  getVillaSearchIntentSummary,
  getVillaTitle as getSeoVillaTitle,
} from "@/lib/seo";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { Amenity, VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { DEFAULT_AMENITY_PREVIEW_COUNT, getAmenityIcon } from "./content-amenities";
import { findFact, findSection } from "./helpers";

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

      <p className="mt-1 text-sm font-bold text-[var(--site-accent)]">

        เริ่มต้น {formatVillaPrice(listing.price)} / คืน

      </p>

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
  const [activeVideoUrls, setActiveVideoUrls] = useState<Set<string>>(
    () => new Set(),
  );

  if (videos.length === 0) {

    return null;

  }

  function playVideo(videoUrl: string) {
    setActiveVideoUrls((currentVideoUrls) => {
      if (currentVideoUrls.has(videoUrl)) {
        return currentVideoUrls;
      }

      const nextVideoUrls = new Set(currentVideoUrls);
      nextVideoUrls.add(videoUrl);
      return nextVideoUrls;
    });
  }

  function getPlayerUrl(embedUrl: string) {
    const url = new URL(embedUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("rel", "0");
    return url.href;
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

            {video.embedUrl && activeVideoUrls.has(video.url) ? (

              <div className="aspect-video bg-[var(--site-primary-hover)]">

                <iframe

                  src={getPlayerUrl(video.embedUrl)}

                  title={video.label}

                  className="h-full w-full"

                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"

                  allowFullScreen

                  loading="lazy"

                  referrerPolicy="strict-origin-when-cross-origin"

                />

              </div>

            ) : video.embedUrl ? (

              <button
                type="button"
                className="group relative grid aspect-video w-full cursor-pointer place-items-center overflow-hidden bg-[var(--site-primary-hover)] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2"
                onClick={() => {
                  playVideo(video.url);
                }}
              >
                {video.thumbnailUrl ? (
                  <Image
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    height={360}
                    sizes="(max-width: 768px) 100vw, 768px"
                    src={video.thumbnailUrl}
                    width={640}
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,40,0.06),rgba(5,15,40,0.72))]"
                />
                <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/92 text-[var(--site-primary)] shadow-[0_18px_42px_rgba(0,0,0,0.24)] transition group-hover:scale-105">
                  <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
                </span>
                <span className="absolute bottom-4 left-4 right-4 text-left">
                  <span className="block text-base font-black text-white drop-shadow">
                    {video.label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-white/85">
                    กดเพื่อเล่นวิดีโอ
                  </span>
                </span>
              </button>

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

            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h3 className="font-black text-[var(--site-text)]">{video.label}</h3>

                <p className="mt-1 break-all text-xs text-[var(--site-muted)]">{video.url}</p>

              </div>

              <a

                href={video.watchUrl}
                target="_blank"

                rel="noreferrer"

                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-black text-[var(--site-on-primary)]"

              >

                เปิดคลิป

                <ArrowRight className="h-4 w-4" />

              </a>

            </div>

          </article>

        ))}

      </div>

    </section>

  );

}

function PolicyCard({

  children,

  icon: Icon,

  title,

}: {

  children: ReactNode;

  icon: typeof Clock;

  title: string;

}) {

  return (

    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">

      <div className="flex items-center gap-3">

        <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">

          <Icon className="h-5 w-5" />

        </span>

        <h3 className="font-black text-[var(--site-text)]">{title}</h3>

      </div>

      <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--site-muted)]">{children}</div>

    </div>

  );

}

export function PolicySection({

  content,

  listing,

}: {

  content: VillaDetailContent;

  listing: VillaListing;

}) {

  const bedroom = findSection(content, "รายละเอียดห้องนอน");

  const parking = findSection(content, "ที่จอดรถ");

  const costs = findSection(content, "ค่าใช้จ่ายเพิ่มเติม");

  const rules = findSection(content, "กฎบ้านพัก");

  const petPolicy = findSection(content, "นโยบายสัตว์เลี้ยง");

  const checkIn = findFact(content.facts, "เช็คอิน");

  const checkOut = findFact(content.facts, "เช็คเอาต์");

  const maxPeople = findFact(content.facts, "พักได้สูงสุด");

  const deposit = findFact(content.facts, "ค่าประกัน");

  const amenities = content.amenities.length > 0
    ? content.amenities
    : listing.amenities;
  const hasPet = amenities.some((amenity) => amenity.key === "pet");

  return (

    <section className="border-t border-[var(--site-border)] py-8">

      <div className="text-center">

        <h2 className="text-2xl font-black text-[var(--site-text)]">นโยบายที่พัก</h2>

        <p className="mt-1 text-sm text-[var(--site-muted)]">

          ข้อมูลสำคัญสำหรับการเข้าพักที่ Baan Pool Villas

        </p>

      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">

        <PolicyCard icon={Clock} title="เวลาเช็คอินและเช็คเอาท์">

          <p>

            เช็คอิน {checkIn ?? "14:00"} และเช็คเอาท์ {checkOut ?? "12:00"}

          </p>

          {(!checkIn || !checkOut) ? (
            <p className="rounded-xl bg-[var(--site-primary-soft)] p-3">
              เวลาเช็คอิน/เช็คเอาต์อาจมีการปรับตามวันพิเศษ
              กรุณาสอบถามทีมงานเพื่อยืนยันเวลาที่แน่นอน
            </p>
          ) : null}

          <p className="rounded-xl bg-[var(--site-primary-soft)] p-3">

            Early check-in / Late check-out: สอบถามทีมงาน

          </p>

        </PolicyCard>

        <PolicyCard icon={ShieldCheck} title="กฎการเข้าพัก">

          {(rules?.lines.length ? rules.lines : ["กรุณารักษาความสะอาดภายในบ้าน", "งดใช้เสียงดังด้านนอกหลังเวลาที่กำหนด"]).map((line, index) => (

            <p key={`${index}-${line}`} className="flex gap-2">

              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-primary)]" />

              <span>{line}</span>

            </p>

          ))}


        </PolicyCard>

        <PolicyCard icon={Car} title="ที่จอดรถและค่าใช้จ่าย">

          {(parking?.lines ?? ["ข้อมูลจุดจอดรถและพื้นที่รับ–ส่งรถสามารถสอบถามทีมงานเพื่อยืนยันก่อนเดินทาง"]).map((line, index) => (

            <p key={`${index}-${line}`}>{line}</p>

          ))}

          {deposit ? <p className="font-black text-[var(--site-text)]">ค่าประกัน {deposit}</p> : null}

          {costs?.lines.slice(0, 3).map((line, index) => (

            <p key={`${index}-${line}`} className="rounded-xl bg-[var(--site-primary-soft)] p-3">

              {line}

            </p>

          ))}

        </PolicyCard>

        <PolicyCard icon={Users} title="จำนวนผู้เข้าพัก">

          <p>รองรับเริ่มต้น {listing.people} ท่าน</p>

          <p>รองรับสูงสุด {maxPeople ?? `${listing.people} คน`}</p>

          {bedroom?.lines.slice(0, 2).map((line, index) => (

            <p key={`${index}-${line}`} className="flex gap-2">

              <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-primary)]" />

              <span>{line}</span>

            </p>

          ))}

        </PolicyCard>

        <PolicyCard icon={PawPrint} title="นโยบายสัตว์เลี้ยง">

          {petPolicy?.lines.length ? (

            petPolicy.lines.map((line, index) => (

              <p key={`${index}-${line}`} className="flex gap-2">

                <PawPrint className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-primary)]" />

                <span>{line}</span>

              </p>

            ))

          ) : (

            <p>{hasPet ? "อนุญาตให้นำสัตว์เลี้ยงเข้าพักได้" : "นโยบายสัตว์เลี้ยงอาจมีข้อจำกัด กรุณาสอบถามทีมงานก่อนยืนยันการจอง"}</p>

          )}

        </PolicyCard>

      </div>

    </section>

  );

}
