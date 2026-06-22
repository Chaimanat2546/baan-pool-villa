"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
          <section className="w-full max-w-lg rounded-lg border border-[var(--villa-border)] bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--villa-teal)] uppercase">
              Server Error
            </p>
            <h1 className="mt-3 text-2xl font-black text-[var(--villa-green-dark)]">
              โหลดหน้านี้ไม่ได้
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              ระบบมีปัญหาระหว่างโหลดข้อมูล ลองโหลดใหม่อีกครั้งได้เลยครับ
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-slate-500">
                รหัสอ้างอิง: {error.digest}
              </p>
            ) : null}
            <button
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[var(--villa-green)] px-4 text-sm font-bold text-white transition hover:bg-[var(--villa-green-dark)] focus-visible:ring-2 focus-visible:ring-[var(--villa-gold)] focus-visible:ring-offset-2 focus-visible:outline-none"
              onClick={reset}
              type="button"
            >
              โหลดใหม่
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
