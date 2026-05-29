import { House, MapPin, MessageCircle, Users } from "lucide-react";

const whyChooseItems = [
  {
    body: "เลือกบ้านพักที่เหมาะกับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้",
    icon: House,
    title: "คัดบ้านพักแนะนำ",
  },
  {
    body: "สอบถามบ้านว่าง ราคา และโปรโมชั่นได้รวดเร็ว",
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

export function WhyChooseSection() {
  return (
    <section
      id="recommendations"
      className="mx-auto w-full max-w-7xl px-6 py-9 sm:px-6 lg:px-8 lg:py-14"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[20px] font-semibold leading-7 text-[var(--site-text)] sm:text-[30px] sm:leading-9">
          ทำไมถึงเลือก Baan Pool Villas
        </h2>
        <p className="mx-auto mt-[7px] max-w-[260px] text-xs leading-5 text-[var(--site-muted)] sm:max-w-none sm:text-base sm:leading-6">
          สัมผัสประสบการณ์พักผ่อนระดับพรีเมียม พร้อมบริการดูแลอย่างใส่ใจในทุกขั้นตอน
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 px-0 py-2 sm:mt-8 sm:gap-6 sm:px-1 sm:py-4 lg:grid-cols-4">
        {whyChooseItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="relative h-[174px] overflow-hidden rounded-[12px] border border-[var(--site-border)] bg-[var(--site-surface)] px-4 pb-3 pt-4 shadow-[0_14px_34px_rgba(15,47,53,0.12)] sm:h-auto sm:min-h-[212px] sm:rounded-[14px] sm:p-8 sm:shadow-[0_18px_38px_rgba(15,47,53,0.16)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[var(--site-accent)]" />
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)] sm:mx-0">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 text-left text-[11px] font-semibold leading-4 text-[var(--site-text)] sm:mt-[23px] sm:text-lg sm:leading-[24px]">
                {item.title}
              </h3>
              <p className="mt-2 text-left text-[11px] leading-[15px] text-[var(--site-muted)] sm:mt-3 sm:text-sm sm:leading-[21px]">
                {item.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
