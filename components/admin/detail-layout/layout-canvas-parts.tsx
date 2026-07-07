export function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        enabled
          ? "border border-[var(--site-primary)]/25 bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
          : "border border-[var(--site-border)] bg-[var(--site-surface-soft)] text-[var(--site-muted)]"
      }`}
    >
      {enabled ? "เปิด" : "ปิด"}
    </span>
  );
}
