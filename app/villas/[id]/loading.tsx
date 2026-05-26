export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-5 text-[#063f35] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="h-10 w-36 animate-pulse rounded-full bg-[#dbe7e3]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="aspect-[16/10] animate-pulse rounded-[28px] bg-[#dbe7e3]" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[4/3] animate-pulse rounded-2xl bg-[#e8f0ec]"
                />
              ))}
            </div>
          </div>
          <div className="h-72 animate-pulse rounded-[24px] bg-white shadow-sm" />
        </div>
        <p className="text-sm font-semibold text-[#55746b]">
          กำลังเตรียมหน้ารายละเอียดบ้านพัก...
        </p>
      </div>
    </main>
  );
}
