import {
  ArrowRight,
  Bath,
  BedDouble,
  Car,
  Check,
  Clock,
  Flame,
  Home,
  MapPin,
  PawPrint,
  PlayCircle,
  ShieldCheck,
  Star,
  Users,
  Waves,
  Wifi,
  Utensils,
} from "lucide-react";
import type { ReactNode } from "react";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { findFact, findSection, getVillaTitle } from "./helpers";
import { MockBadge } from "./shared";

export function VillaIntro({
  content,
  listing,
}: {
  content: VillaDetailContent;
  listing: VillaListing;
}) {
  return (
    <section className="border-b border-[#dbe7e3] pb-6">
      <span className="rounded-full bg-[#edf4f1] px-3 py-1 text-xs font-black text-[#0f5a66]">
        DV-{listing.id}
      </span>
      <h1 className="mt-3 text-[28px] font-black leading-tight text-[#063f35] sm:text-4xl">
        {getVillaTitle(listing.id)}
      </h1>
      <p className="mt-1 text-sm font-bold text-[#e1a100]">
        เริ่มต้น {formatVillaPrice(listing.price)} / คืน
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#55746b]">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-[#0f5a66]" />
          {content.location?.address ?? listing.zoneLabel}
        </span>
        <span>ห่างทะเล {content.location?.seaDistance ?? listing.distanceToSea}</span>
        {content.location?.mapUrl ? (
          <a
            href={content.location.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="font-black text-[#064d3d] underline-offset-4 hover:underline"
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
    <div className="flex items-center gap-3 rounded-2xl bg-[#f6faf8] px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f2ef] text-[#0f5a66]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-xs font-bold text-[#6d867e]">{label}</span>
        <span className="block text-sm font-black text-[#063f35]">{value}</span>
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
      `${getVillaTitle(listing.id)} เหมาะสำหรับครอบครัวและกลุ่มเพื่อนที่ต้องการพื้นที่พักผ่อนส่วนตัว`,
      "ข้อมูลคำบรรยายหลักยังไม่มีจาก API จึง mock ไว้ที่ FE ตรงสิ่งนี้",
    ];
  return (
    <section className="py-8">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-black text-[#063f35]">เกี่ยวกับบ้านพัก</h2>
        {!moreDetail ? <MockBadge /> : null}
      </div>
      <div className="mt-3 space-y-2 text-sm leading-7 text-[#55746b]">
        {descriptionLines.map((line, index) => (
          <p key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
    </section>
  );
}
export function AmenitiesSection({ listing }: { listing: VillaListing }) {
  const icons = [Waves, Flame, Utensils, Wifi, Home, PawPrint, Car, Star];
  return (
    <section className="py-6">
      <h2 className="text-2xl font-black text-[#063f35]">สิ่งอำนวยความสะดวก</h2>
      <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {listing.amenities.map((amenity, index) => {
          const Icon = icons[index % icons.length];
          return (
            <div key={amenity.key} className="flex items-center gap-3 text-sm font-semibold text-[#254f47]">
              <Icon className="h-4 w-4 text-[#0f5a66]" />
              {amenity.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function VideoReviewSection({ videos }: { videos: VillaDetailContent["videos"] }) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-[#dbe7e3] py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f2ef] text-[#0f5a66]">
          <PlayCircle className="h-5 w-5" />
        </span>
        <h2 className="text-2xl font-black text-[#063f35]">คลิปรีวิวบ้านพัก</h2>
      </div>
      <div className="mt-5 grid gap-4">
        {videos.map((video) => (
          <article
            key={video.url}
            className="overflow-hidden rounded-2xl border border-[#dbe7e3] bg-white shadow-[0_14px_38px_rgba(6,63,53,0.08)]"
          >
            {video.embedUrl ? (
              <div className="aspect-video bg-[#062f28]">
                <iframe
                  src={video.embedUrl}
                  title={video.label}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="grid min-h-44 place-items-center bg-[#edf4f1] p-6 text-center">
                <div>
                  <PlayCircle className="mx-auto h-10 w-10 text-[#0f5a66]" />
                  <p className="mt-3 text-sm font-bold text-[#55746b]">
                    ลิงก์นี้ยังไม่รองรับการฝังวิดีโอในหน้าเว็บ
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black text-[#063f35]">{video.label}</h3>
                <p className="mt-1 break-all text-xs text-[#6d867e]">{video.url}</p>
              </div>
              <a
                href={video.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#063f35] px-4 py-2 text-sm font-black text-white"
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
    <div className="rounded-2xl border border-[#dbe7e3] bg-white p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf4f1] text-[#0f5a66]">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="font-black text-[#063f35]">{title}</h3>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-6 text-[#55746b]">{children}</div>
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
  const hasPet = listing.amenities.some((amenity) => amenity.key === "pet");
  return (
    <section className="border-t border-[#dbe7e3] py-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#064d3d]">นโยบายที่พัก</h2>
        <p className="mt-1 text-sm text-[#55746b]">
          ข้อมูลสำคัญสำหรับการเข้าพักที่ Baan Pool Villas
        </p>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PolicyCard icon={Clock} title="เวลาเช็คอินและเช็คเอาท์">
          <p>
            เช็คอิน {checkIn ?? "14:00"} และเช็คเอาท์ {checkOut ?? "12:00"}
          </p>
          {!checkIn || !checkOut ? <MockBadge /> : null}
          <p className="rounded-xl bg-[#eef7f3] p-3">
            Early check-in / Late check-out: สอบถามทีมงาน
          </p>
        </PolicyCard>
        <PolicyCard icon={ShieldCheck} title="กฎการเข้าพัก">
          {(rules?.lines.length ? rules.lines : ["กรุณารักษาความสะอาดภายในบ้าน", "งดใช้เสียงดังด้านนอกหลังเวลาที่กำหนด"]).map((line, index) => (
            <p key={`${index}-${line}`} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0f5a66]" />
              <span>{line}</span>
            </p>
          ))}
          {!rules ? <MockBadge /> : null}
        </PolicyCard>
        <PolicyCard icon={Car} title="ที่จอดรถและค่าใช้จ่าย">
          {(parking?.lines ?? ["รายละเอียดที่จอดรถยังไม่มีใน API"]).map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
          {deposit ? <p className="font-black text-[#063f35]">ค่าประกัน {deposit}</p> : null}
          {costs?.lines.slice(0, 3).map((line, index) => (
            <p key={`${index}-${line}`} className="rounded-xl bg-[#eef7f3] p-3">
              {line}
            </p>
          ))}
        </PolicyCard>
        <PolicyCard icon={Users} title="จำนวนผู้เข้าพัก">
          <p>รองรับเริ่มต้น {listing.people} ท่าน</p>
          <p>รองรับสูงสุด {maxPeople ?? `${listing.people} คน`}</p>
          {bedroom?.lines.slice(0, 2).map((line, index) => (
            <p key={`${index}-${line}`} className="flex gap-2">
              <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[#0f5a66]" />
              <span>{line}</span>
            </p>
          ))}
        </PolicyCard>
        <PolicyCard icon={PawPrint} title="นโยบายสัตว์เลี้ยง">
          {petPolicy?.lines.length ? (
            petPolicy.lines.map((line, index) => (
              <p key={`${index}-${line}`} className="flex gap-2">
                <PawPrint className="mt-0.5 h-4 w-4 shrink-0 text-[#0f5a66]" />
                <span>{line}</span>
              </p>
            ))
          ) : (
            <p>{hasPet ? "อนุญาตให้นำสัตว์เลี้ยงเข้าพักได้" : "ยังไม่มีข้อมูลสัตว์เลี้ยงจาก API"}</p>
          )}
          {!petPolicy ? <MockBadge /> : null}
        </PolicyCard>
      </div>
    </section>
  );
}
