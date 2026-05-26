import Image from "next/image";
import Link from "next/link";

function MockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ${className}`}
    >
      Mock FE
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[#033a35] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/40 bg-white/10">
              <Image
                src="/images/logo.jpg"
                alt="Pool Villas Pattaya"
                fill
                sizes="56px"
                className="object-cover"
              />
            </span>
            <div>
              <h2 className="text-xl font-black">Pool Villas Pattaya</h2>
              <p className="text-xs text-emerald-100">
                ครบครัน ใกล้ทะเล สำหรับทริปส่วนตัว
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-emerald-50/80">
            บ้านพักพูลวิลล่าพัทยา พร้อมสระส่วนตัวและพื้นที่พักผ่อนสำหรับครอบครัวและกลุ่มเพื่อน
          </p>
        </div>
        <div>
          <h3 className="font-black">เมนูหลัก</h3>
          <div className="mt-4 grid gap-2 text-sm text-emerald-50/80">
            <Link href="/">หน้าแรก</Link>
            <Link href="/search">บ้านทั้งหมด</Link>
            <Link href="/#recommendations">รีวิว</Link>
            <Link href="/#contact">ติดต่อเรา</Link>
          </div>
        </div>
        <div>
          <h3 className="font-black">ติดต่อเรา</h3>
          <div className="mt-4 grid gap-2 text-sm text-emerald-50/80">
            <span>098-637-8550</span>
            <span>LINE: @poolvilla_pw</span>
            <span>พัทยา ชลบุรี</span>
            <MockBadge />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-emerald-50/70">
        © 2024 Baan Pool Villas. All rights reserved.
      </div>
    </footer>
  );
}
