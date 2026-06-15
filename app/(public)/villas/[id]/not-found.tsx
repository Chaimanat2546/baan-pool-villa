import { ChevronLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--site-surface-soft)] px-4 py-5 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[70vh] w-full max-w-3xl place-items-center">
        <div className="w-full rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 py-10 text-center shadow-[0_14px_42px_rgba(6,63,53,0.08)]">
          <h1 className="text-2xl font-black text-[var(--site-text)]">ไม่พบบ้านพักนี้</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--site-muted)]">
            บ้านพักอาจไม่มีอยู่ในระบบ หรืออาจถูกปิดการแสดงผลชั่วคราว
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-5 py-3 text-sm font-bold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปหน้าค้นหา
          </a>
        </div>
      </div>
    </main>
  );
}
