import {
  BedDouble,
  Car,
  Check,
  Clock,
  PawPrint,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { findFact, findSection } from "./helpers";

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
          {(rules?.lines.length
            ? rules.lines
            : [
                "กรุณารักษาความสะอาดภายในบ้าน",
                "งดใช้เสียงดังด้านนอกหลังเวลาที่กำหนด",
              ]).map((line, index) => (
            <p key={`${index}-${line}`} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-primary)]" />
              <span>{line}</span>
            </p>
          ))}
        </PolicyCard>

        <PolicyCard icon={Car} title="ที่จอดรถและค่าใช้จ่าย">
          {(parking?.lines ?? [
            "ข้อมูลจุดจอดรถและพื้นที่รับ-ส่งรถสามารถสอบถามทีมงานเพื่อยืนยันก่อนเดินทาง",
          ]).map((line, index) => (
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
            <p>
              {hasPet
                ? "อนุญาตให้นำสัตว์เลี้ยงเข้าพักได้"
                : "นโยบายสัตว์เลี้ยงอาจมีข้อจำกัด กรุณาสอบถามทีมงานก่อนยืนยันการจอง"}
            </p>
          )}
        </PolicyCard>
      </div>
    </section>
  );
}
