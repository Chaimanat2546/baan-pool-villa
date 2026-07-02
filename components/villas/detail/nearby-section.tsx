import { ArrowRight, MapPin } from "lucide-react";
import type { VillaDetailContent } from "@/lib/villas/detail";

interface NearbyCard {
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
      <div className="mt-5 max-h-[260px] overflow-y-auto overflow-x-hidden pr-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-[var(--site-text)]">
            จุดหมายจาก Google Maps
          </h3>
          <span className="text-xs font-bold text-[var(--site-muted)]">
            เลื่อนได้
          </span>
        </div>
        <div className="space-y-3">
          {cards.map((card) => (
            <a
              key={card.key}
              href={card.href ?? "#"}
              target={card.href ? "_blank" : undefined}
              rel={card.href ? "noreferrer" : undefined}
              className="block rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[0_10px_30px_rgba(6,63,53,0.06)] transition hover:-translate-y-0.5 hover:border-[var(--site-border-strong)] hover:shadow-[0_16px_34px_rgba(6,63,53,0.11)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-[var(--site-primary)]">
                  {card.category}
                </span>
                {card.isGoogleMap ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--site-primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--site-primary)]">
                    <MapPin className="h-3 w-3" />
                    Google Maps
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 break-words text-base font-black leading-6 text-[var(--site-text)]">
                {card.title}
              </h3>
              {card.href ? (
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[var(--site-primary)]">
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
