import { ChevronDown } from "lucide-react";

import { SectionHeader } from "./section-header";

const faqItems = [
  {
    answer:
      "เลือกบ้านพักที่สนใจ แล้วติดต่อทีมงานผ่าน LINE หรือโทรแจ้งวันเข้าพัก จำนวนคน และบ้านที่ต้องการ ทีมงานจะเช็กบ้านว่างและสรุปรายละเอียดการจองให้",
    question: "จองบ้านพักต้องทำอย่างไร",
  },
  {
    answer:
      "ติดต่อผ่าน LINE ได้โดยกดปุ่ม LINE ด้านล่างหน้าจอ หรือแจ้งรหัสบ้านพักที่สนใจเพื่อให้ทีมงานช่วยตรวจวันว่างและราคา",
    question: "สามารถติดต่อผ่าน LINE ได้ไหม",
  },
  {
    answer:
      "บ้านพักหลายหลังเหมาะกับกลุ่มเพื่อนและปาร์ตี้ แต่เงื่อนไขเสียงดัง จำนวนผู้เข้าพัก และเวลาการใช้งานขึ้นอยู่กับแต่ละหลัง ทีมงานจะแจ้งก่อนยืนยันจอง",
    question: "บ้านพักเหมาะกับปาร์ตี้ไหม",
  },
  {
    answer:
      "ราคาที่แสดงเป็นราคาเริ่มต้นต่อคืน และอาจเปลี่ยนตามวันเข้าพัก ช่วงเทศกาล จำนวนคน และเงื่อนไขของบ้านแต่ละหลัง",
    question: "ราคาที่แสดงเป็นราคาต่อคืนหรือไม่",
  },
  {
    answer:
      "บริการเสริมขึ้นอยู่กับบ้านพักและช่วงเวลา เช่น เตาปิ้งย่าง คาราโอเกะ ห่วงยาง หรือบริการเสริมอื่น ๆ สามารถสอบถามทีมงานก่อนจองได้",
    question: "มีบริการเสริมอะไรบ้าง",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <SectionHeader
        title="คำถามที่พบบ่อย"
        description="ข้อมูลเบื้องต้นเกี่ยวกับการจอง การเช็กอิน และนโยบายบ้านพัก"
      />
      <div className="mt-8 space-y-3">
        {faqItems.map((item) => (
          <details
            key={item.question}
            className="group overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_10px_28px_rgba(6,63,53,0.06)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:hidden sm:px-6 sm:py-5">
              <span className="font-black text-[var(--site-text)]">{item.question}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-[var(--site-primary)] transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--site-border)] px-5 pb-5 pt-4 text-sm leading-6 text-[var(--site-muted)] sm:px-6">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
