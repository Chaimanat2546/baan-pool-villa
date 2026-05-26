import { CreditCard, MessageCircle, Phone } from "lucide-react";

const contactCards = [
  {
    detail: "061-748-5213",
    icon: Phone,
    label: "คุณเกม :",
    title: "ช่วง 07.00-15.00",
    href: "tel:0617485213",
  },
  {
    detail: "065-732-9919",
    icon: Phone,
    label: "คุณโก้ :",
    title: "ช่วง 16.00-02.00",
    href: "tel:0657329919",
  },
  {
    detail: "@baanpoolvilla",
    icon: MessageCircle,
    label: "LINE ID:",
    title: "LINE Official",
    href: "https://line.me/R/ti/p/@baanpoolvilla",
  },
];

const bankRows = [
  { label: "ธนาคาร", value: "กสิกรไทย" },
  { label: "เลขบัญชี", value: "137-1-17528-4" },
  { label: "ชื่อบัญชี", value: "บริษัท พูลวิลล่า พัทยา จำกัด ธนาคาร กสิกรไทย" },
];

export function ContactSection() {
  return (
    <section id="contact" className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-black leading-tight text-[#064e3b]">
            ช่องทางการติดต่อ
          </h2>
          <p className="mt-2 text-base text-[#111827]">พร้อมให้บริการและตอบทุกคำถาม</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;

            return (
              <a
                href={card.href}
                target={card.href.startsWith("http") ? "_blank" : undefined}
                rel={card.href.startsWith("http") ? "noopener noreferrer" : undefined}
                key={card.title}
                className="block rounded-[20px] border border-[#e2e8f0] bg-white p-7 shadow-[0_8px_24px_rgba(15,47,53,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(15,47,53,0.12)] active:translate-y-0 sm:p-8"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f1f5f9] text-[#064e3b]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-xl font-black leading-8 text-[#064e3b] sm:text-2xl">
                    {card.title}
                  </h3>
                </div>
                <p className="mt-7 flex flex-wrap items-center gap-2 text-lg font-black text-[#064e3b] sm:text-xl">
                  <span>{card.label}</span>
                  <span className="text-[#eab308]">{card.detail}</span>
                </p>
              </a>
            );
          })}
        </div>

        <article className="mt-8 rounded-2xl border border-[#e2e8f0] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(15,47,53,0.12)] sm:p-6 lg:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#064e3b]">
              <CreditCard className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-2xl font-black leading-tight sm:text-3xl">
                ข้อมูลการโอนเงิน
              </h3>
              <p className="mt-1 text-xs text-white/90">กรุณาโอนเข้าบัญชีนี้เท่านั้น</p>
            </div>
          </div>

          <div className="mt-7 rounded-xl bg-white p-3 text-[#334155]">
            <dl className="divide-y divide-[#e2e8f0]">
              {bankRows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 py-3 text-sm sm:grid-cols-[160px_1fr] sm:items-center sm:text-base"
                >
                  <dt>{row.label}</dt>
                  <dd className="font-black text-[#243145] sm:text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-lg bg-[#fef3c7] px-3 py-2 text-center text-xs leading-5 text-[#064e3b]">
              หลังโอนเงินแล้ว กรุณาส่งหลักฐานการโอนมาที่ LINE หรือ Messenger
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
