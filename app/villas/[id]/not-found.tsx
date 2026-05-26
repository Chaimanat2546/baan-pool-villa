import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen px-4 py-5 text-[#063f35] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[70vh] w-full max-w-3xl place-items-center">
        <div className="w-full rounded-[24px] border border-[#dbe7e3] bg-white px-6 py-10 text-center shadow-[0_14px_42px_rgba(6,63,53,0.08)]">
          <h1 className="text-2xl font-black text-[#063f35]">ไม่พบบ้านพักนี้</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#55746b]">
            บ้านพักอาจไม่มีอยู่ในระบบ หรืออาจถูกปิดการแสดงผลชั่วคราว
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#063f35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f5a66]"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปหน้าค้นหา
          </Link>
        </div>
      </div>
    </main>
  );
}
