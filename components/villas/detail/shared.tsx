export function MockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ${className}`}
    >
      Mock FE
    </span>
  );
}
