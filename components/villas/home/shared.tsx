export function MockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-[var(--site-border)] bg-[var(--site-accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--site-accent)] ${className}`}
    >
      Mock FE
    </span>
  );
}
