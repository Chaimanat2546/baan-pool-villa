import { ArrowRight, MapPin } from "lucide-react";
import type { VillaDetailContent } from "@/lib/villas/detail";

type NearbyCard = {
  category: string;
  href: string | null;
  isGoogleMap: boolean;
  key: string;
  title: string;
};

function isGoogleMapsUrl(url: string | null): boolean {
  return typeof url === "string" && /(google|g\.page|goo\.gl|maps\.app\.goo\.gl)/i.test(url);
}

export function NearbySection({
  content,
}: {
  content: VillaDetailContent;
}) {
  const cards: NearbyCard[] = content.nearbyPlaces.map((place, index) => ({
    category: place.zone ?? "Nearby",
    href: place.url,
    isGoogleMap: isGoogleMapsUrl(place.url),
    key: `${index}-${place.name}-${place.url ?? "place"}`,
    title: place.name,
  }));

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="min-w-0">
      <h2 className="text-left text-2xl font-black text-[#064d3d] lg:text-center">
        สถานที่ท่องเที่ยวแนะนำ
      </h2>
      <div className="mt-5 lg:max-h-[720px] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-[#064d3d]">
            จุดหมายจาก Google Maps
          </h3>
          <span className="text-xs font-bold text-[#6d867e] lg:hidden">
            เลื่อนได้
          </span>
        </div>
        <div className="-mx-0.5 flex snap-x gap-4 overflow-x-auto px-0.5 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
          {cards.map((card) => (
            <a
              key={card.key}
              href={card.href ?? "#"}
              target={card.href ? "_blank" : undefined}
              rel={card.href ? "noreferrer" : undefined}
              className="block w-[299px] shrink-0 snap-start rounded-2xl border border-[#dbe7e3] bg-white p-4 shadow-[0_10px_30px_rgba(6,63,53,0.06)] transition hover:-translate-y-0.5 hover:border-[#9fc7bd] hover:shadow-[0_16px_34px_rgba(6,63,53,0.11)] sm:w-[56%] lg:w-full"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-[#0f5a66]">
                  {card.category}
                </span>
                {card.isGoogleMap ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eef7f3] px-2 py-0.5 text-[11px] font-bold text-[#0f5a66]">
                    <MapPin className="h-3 w-3" />
                    Google Maps
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 break-words text-base font-black leading-6 text-[#063f35]">
                {card.title}
              </h3>
              {card.href ? (
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#064d3d]">
                  เปิดแผนที่ <ArrowRight className="h-3 w-3" />
                </span>
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
