import type { HomeSectionMode } from "@/lib/home-sections/types";

import { MODE_LABELS } from "./section-helpers";

interface AutoModeSummaryProps {
  mode: Exclude<HomeSectionMode, "manual">;
}

export function AutoModeSummary({ mode }: AutoModeSummaryProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--site-text)]">
          {MODE_LABELS.get(mode) ?? "เลือกบ้านให้"}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
          เลือกบ้านตามวิธีนี้ โดยใช้จำนวนบ้านที่ตั้งไว้ด้านบน
        </p>
      </div>
    </div>
  );
}
