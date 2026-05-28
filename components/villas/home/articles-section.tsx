import { ArrowRight } from "lucide-react";
import Image from "next/image";

import type { VillaListing } from "@/lib/villas/types";

import { ScrollRail } from "./scroll-rail";
import { SectionHeader } from "./section-header";
import { MockBadge } from "./shared";

const articleCards = [
  {
    body: "คาเฟ่บรรยากาศทะเล เหมาะกับถ่ายรูปและนั่งชิลระหว่างทริป",
    category: "จอมเทียน",
    title: "Sea Salt Cafe",
  },
  {
    body: "คาเฟ่สวนใกล้ชายหาด เหมาะกับครอบครัวและกลุ่มเพื่อน",
    category: "บางแสน",
    title: "Garden Beach Cafe",
  },
  {
    body: "เช็กลิสต์สิ่งอำนวยความสะดวกที่ควรมองหาก่อนจองบ้านพักสำหรับกลุ่มใหญ่",
    category: "Checklist",
    title: "เตรียมตัวก่อนจองบ้านพัก",
  },
];

interface ArticlesSectionProps {
  villas: VillaListing[];
}

export function ArticlesSection({ villas }: ArticlesSectionProps) {
  return (
    <section id="cafes" className="mx-auto w-full max-w-7xl scroll-mt-28 px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader
        title="คาเฟ่ที่แนะนำ"
        description="รวมคาเฟ่น่าแวะใกล้โซนบ้านพัก ช่วยให้วางแผนทริปได้ครบทั้งที่พักและที่เที่ยว"
      />
      <ScrollRail
        label="คาเฟ่ที่แนะนำ"
        className="-mx-4 mt-8 gap-6 px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {articleCards.slice(0, 12).map((article, index) => {
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
      </ScrollRail>
    </section>
  );
}
