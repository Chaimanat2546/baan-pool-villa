import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { ScrollRail } from "@/components/ui/scroll-rail";
import type { PublicAdvertisement } from "@/lib/advertisements/types";

import { SectionHeader } from "./section-header";

interface ActivitiesSectionProps {
  advertisements: PublicAdvertisement[];
}

export function ActivitiesSection({ advertisements }: ActivitiesSectionProps) {
  if (advertisements.length === 0) {
    return null;
  }

  return (
    <section
      id="activities"
      className="mx-auto w-full max-w-7xl scroll-mt-28 px-4 py-14 sm:px-6 lg:px-8"
      data-home-activities
    >
      <SectionHeader
        title="กิจกรรมที่น่าสนใจ"
        description="ไอเดียกิจกรรมและประสบการณ์ใกล้บ้านพัก สำหรับเติมทริปพูลวิลล่าให้สนุกขึ้น"
      />
      <ScrollRail
        label="กิจกรรมที่น่าสนใจ"
        className="-mx-4 mt-8 gap-6 px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {advertisements.map((advertisement) => (
          <article
            className="flex h-full w-[306px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_12px_34px_rgba(6,63,53,0.07)] md:w-[394px]"
            key={advertisement.id}
          >
            <div className="relative aspect-[4/3] bg-[var(--site-surface-tint)]">
              <Image
                alt={advertisement.title}
                className="object-cover"
                fill
                quality={60}
                sizes="(max-width: 768px) 306px, 394px"
                src={advertisement.imageUrl}
              />
            </div>
            <div className="flex min-h-24 flex-1 items-center p-6">
              <h2 className="line-clamp-2 text-xl font-semibold leading-7 text-[var(--site-text)]">
                {advertisement.title}
              </h2>
            </div>
          </article>
        ))}
      </ScrollRail>
    </section>
  );
}
