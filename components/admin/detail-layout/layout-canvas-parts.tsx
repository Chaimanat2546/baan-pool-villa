import { Lock } from "lucide-react";
import type { ReactNode } from "react";

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

export function LockedShell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--site-muted)]">
          {label}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--site-primary)]">
          <Lock aria-hidden="true" className="size-3" />
          ล็อก
        </span>
      </div>
      {children}
    </div>
  );
}
