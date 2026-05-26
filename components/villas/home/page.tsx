"use client";

import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  HelpCircle,
  MapPin,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "../listing/villa-card";

type HousesResponse = {
  items: VillaListing[];
};

const WHY_CHOOSE_ITEMS = [
  {
    body: "เลือกบ้านพักที่เหมาะกับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้",
    icon: BadgeCheck,
    title: "คัดบ้านพักแนะนำ",
  },
  {
    body: "สอบถามบ้านว่าง ราคา และโปรโมชันได้รวดเร็ว",
    icon: MessageCircle,
    title: "ติดต่อสะดวกผ่าน LINE",
  },
  {
    body: "พัทยา บางแสน หัวหิน และบ้านใกล้ทะเล",
    icon: MapPin,
    title: "มีหลายทำเลให้เลือก",
  },
  {
    body: "ทริปครอบครัว วันเกิด ปาร์ตี้บริษัท หรือพักผ่อนส่วนตัว",
    icon: Users,
    title: "เหมาะกับทุกทริป",
  },
];

const DESTINATIONS = [
  {
    body: "พูลวิลล่าบางแสนสำหรับทริปสั้น ๆ ใกล้กรุงเทพ เหมาะกับครอบครัว เพื่อน และวันหยุดสุดสัปดาห์",
    tags: ["ใกล้ทะเล", "ทริปสั้น", "ครอบครัว"],
    title: "บ้านบางแสน",
  },
  {
    body: "พูลวิลล่าหัวหินสำหรับทริปพักผ่อนแบบส่วนตัว บรรยากาศสงบ เหมาะกับครอบครัวและกลุ่มเพื่อน",
    tags: ["สงบ", "พูลวิลล่า", "พักผ่อน"],
    title: "บ้านหัวหิน",
  },
];

const ARTICLE_CARDS = [
  {
    body: "คาเฟ่บรรยากาศทะเล เหมาะกับถ่ายรูปและนั่งชิล",
    category: "จอมเทียน",
    title: "Sea Salt Cafe",
  },
  {
    body: "คาเฟ่สวนใกล้ชายหาด เหมาะกับครอบครัว",
    category: "บางแสน",
    title: "Garden Beach Cafe",
  },
  {
    body: "เช็กลิสต์สิ่งอำนวยความสะดวกที่ควรมองหาก่อนจอง",
    category: "Checklist",
    title: "เตรียมตัวก่อนจองบ้านพักสำหรับกลุ่มใหญ่",
  },
];

const FAQ_ITEMS = [
  "จองบ้านพักต้องทำอย่างไร?",
  "สามารถติดต่อผ่าน LINE ได้ไหม?",
  "บ้านพักเหมาะกับปาร์ตี้ไหม?",
  "ราคาที่แสดงเป็นราคาต่อคืนหรือไม่?",
  "มีบริการเสริมอะไรบ้าง?",
];

function MockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ${className}`}
    >
      Mock FE
    </span>
  );
}

function SectionHeader({
  align = "center",
  eyebrow,
  title,
  description,
}: {
  align?: "center" | "left";
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f5a66]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-black leading-tight text-[#063f35] md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#55746b] md:text-base">{description}</p>
    </div>
  );
}

function VillaRail({
  cta,
  description,
  title,
  villas,
}: {
  cta?: boolean;
  description: string;
  title: string;
  villas: VillaListing[];
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader title={title} description={description} />
      <div className="-mx-4 mt-8 flex snap-x gap-6 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {villas.slice(0, 12).map((villa, index) => (
          <div key={villa.id} className="w-[290px] shrink-0 snap-start md:w-[394px]">
            <VillaCard villa={villa} preload={index === 0} />
          </div>
        ))}
      </div>
      {cta ? (
        <div className="mt-8 text-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-[#064d3d] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(6,77,61,0.22)]"
          >
            ดูบ้านพักทั้งหมด <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function HomePage() {
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadVillas() {
      try {
        setIsLoading(true);

        const response = await fetch("/api/houses");

        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลบ้านพักได้");
        }

        const payload = (await response.json()) as HousesResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!isActive) {
          return;
        }

        setVillas(items);
      } catch (caughtError) {
        console.error(caughtError);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadVillas();

    return () => {
      isActive = false;
    };
  }, []);

  const featuredVillas = useMemo(() => villas.slice(0, 12), [villas]);
  const popularVillas = useMemo(() => villas.slice(12, 24), [villas]);
  const beachVillas = useMemo(
    () =>
      villas
        .filter((villa) => villa.distanceToSea !== "-")
        .slice(0, 12),
    [villas],
  );
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfdfb] text-[#063f35]">
      <section className="bg-[#13a7d7]">
        <Image
          src="/images/BPV-66_Cover-Web.jpg"
          alt="Pool Villa บ้านพูลวิลล่า พัทยา"
          width={1565}
          height={1043}
          priority
          sizes="100vw"
          className="h-auto w-full"
        />
      </section>

      <div>
        {isLoading ? (
          <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[373px] animate-pulse rounded-[22px] border border-[#dbe7e3] bg-white"
                />
              ))}
            </div>
          </section>
        ) : null}

        {featuredVillas.length > 0 ? (
          <VillaRail
            cta
            title="บ้านพักแนะนำ"
            description="พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว"
            villas={featuredVillas}
          />
        ) : null}

        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader
            title="ทำไมถึงเลือก Baan Pool Villas"
            description="สัมผัสประสบการณ์พักผ่อนระดับพรีเมียม พร้อมบริการดูแลอย่างใส่ใจในทุกขั้นตอน"
          />
          <div className="-mx-4 mt-8 flex snap-x gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {WHY_CHOOSE_ITEMS.slice(0, 12).map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="w-[286px] shrink-0 snap-start rounded-2xl border border-[#dbe7e3] bg-white p-8 shadow-[0_12px_34px_rgba(6,63,53,0.07)]"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef7f3] text-[#064d3d]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-6 text-lg font-black text-[#063f35]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#55746b]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {popularVillas.length > 0 ? (
          <VillaRail
            title="พูลวิลล่าพัทยายอดฮิต"
            description="บ้านพักยอดนิยมสำหรับทริปพัทยา ใกล้แหล่งท่องเที่ยว เดินทางสะดวก และเหมาะกับกลุ่มเพื่อน"
            villas={popularVillas}
          />
        ) : null}

        {beachVillas.length > 0 ? (
          <VillaRail
            title="บ้านพักใกล้ทะเล"
            description="เลือกพูลวิลล่าใกล้ชายหาด เดินทางง่าย เหมาะกับคนที่อยากพักผ่อนใกล้ทะเล"
            villas={beachVillas}
          />
        ) : null}

        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader
            title="สำรวจจุดหมายปลายทางของเรา"
            description="ค้นหาสถานที่พักผ่อนที่สมบูรณ์แบบสำหรับครอบครัวและเพื่อนของคุณกับพูลวิลล่าสมัยใหม่ที่เราได้คัดสรรอย่างพิถีพิถัน"
          />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {DESTINATIONS.slice(0, 12).map((destination, index) => {
              const destinationImage = villas[index]?.coverImage;

              return (
                <article
                  key={destination.title}
                  className="relative min-h-[420px] overflow-hidden rounded-3xl bg-[#063f35] text-white shadow-[0_18px_52px_rgba(6,63,53,0.16)]"
                >
                  {destinationImage ? (
                    <Image
                      src={destinationImage}
                      alt={destination.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover opacity-70"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#032f29]/90 via-[#032f29]/25 to-transparent" />
                  <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/15 p-6 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black">{destination.title}</h3>
                      <MockBadge />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-emerald-50">{destination.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {destination.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader
            title="คาเฟ่ที่แนะนำ"
            description="รวมคาเฟ่น่าแวะใกล้โซนบ้านพัก ช่วยให้วางแผนทริปได้ครบทั้งที่พักและที่เที่ยว"
          />
          <div className="-mx-4 mt-8 flex snap-x gap-6 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {ARTICLE_CARDS.slice(0, 12).map((article, index) => {
              const articleImage = villas[index + 2]?.coverImage;

              return (
                <article
                  key={article.title}
                  className="w-[306px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#dbe7e3] bg-white shadow-[0_12px_34px_rgba(6,63,53,0.07)] md:w-[394px]"
                >
                  <div className="relative aspect-[4/3] bg-[#e6efeb]">
                    {articleImage ? (
                      <Image
                        src={articleImage}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : null}
                    <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-black text-[#064d3d] backdrop-blur">
                      {article.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-[#063f35]">{article.title}</h3>
                      <MockBadge />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#55746b]">{article.body}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#064d3d]">
                      อ่านต่อ <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
          <SectionHeader
            title="คำถามที่พบบ่อย"
            description="ข้อมูลเบื้องต้นเกี่ยวกับการจอง การเช็คอิน และนโยบายบ้านพัก"
          />
          <div className="mt-8 divide-y divide-[#dbe7e3] overflow-hidden rounded-2xl border border-[#dbe7e3] bg-white">
            {FAQ_ITEMS.map((question) => (
              <div key={question} className="flex items-center justify-between gap-4 px-6 py-5">
                <span className="font-black text-[#063f35]">{question}</span>
                <HelpCircle className="h-5 w-5 shrink-0 text-[#0f5a66]" />
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="bg-[#064d3d] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-black">ยังไม่แน่ใจว่าควรเลือกบ้านหลังไหนดี?</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/85">
              แจ้งจำนวนคน วันเข้าพัก ทำเลที่ต้องการ และงบประมาณ ทีมงานจะช่วยแนะนำพูลวิลล่าที่เหมาะกับทริปของคุณ
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#064d3d]">
                <MessageCircle className="h-4 w-4" />
                ติดต่อผ่าน LINE
                <MockBadge />
              </Link>
              <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-black text-white">
                <Phone className="h-4 w-4" />
                โทรสอบถาม
                <MockBadge />
              </Link>
              <Link href="/search" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-black text-white">
                <CreditCard className="h-4 w-4" />
                ดูบ้านพักทั้งหมด
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
