import Image from "next/image";

import { SectionHeader } from "./section-header";

const destinations = [
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

type DestinationVilla = {
  coverImage: string | null;
};

interface DestinationsSectionProps {
  villas: DestinationVilla[];
}

export function DestinationsSection({ villas }: DestinationsSectionProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeader
        title="สำรวจจุดหมายปลายทางของเรา"
        description="ค้นหาสถานที่พักผ่อนที่สมบูรณ์แบบสำหรับครอบครัวและเพื่อนของคุณกับพูลวิลล่าสมัยใหม่ที่เราคัดสรรอย่างพิถีพิถัน"
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {destinations.slice(0, 12).map((destination, index) => {
          const destinationImage = villas[index]?.coverImage;

          return (
            <article
              key={destination.title}
              className="relative min-h-[420px] overflow-hidden rounded-3xl bg-[var(--site-primary)] text-[var(--site-on-primary)] shadow-[0_18px_52px_rgba(6,63,53,0.16)]"
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
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in srgb, var(--site-primary) 92%, transparent), color-mix(in srgb, var(--site-primary) 28%, transparent), transparent)",
                }}
              />
              <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/15 p-6 backdrop-blur">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black">{destination.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--site-on-primary)] opacity-90">{destination.body}</p>
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
  );
}
