import type { AdminSectionDraft } from "./types";
import {
  MODE_OPTIONS,
  normalizeAdminFallbackMode,
} from "./section-helpers";

interface SectionConfigFormProps {
  onChange: (changes: Partial<Omit<AdminSectionDraft, "draftId">>) => void;
  section: AdminSectionDraft;
}

export function SectionConfigForm({
  onChange,
  section,
}: SectionConfigFormProps) {
  return (
    <>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)]">
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-[var(--site-text)]">
            วิธีเลือกบ้านพัก
          </legend>
          <div className="mt-3 grid gap-3">
            {MODE_OPTIONS.map((mode) => {
              const isSelected = section.mode === mode.value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-20 rounded-xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[var(--site-primary)] bg-[var(--site-surface-soft)] shadow-sm"
                      : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] hover:bg-[var(--site-surface-soft)]"
                  }`}
                  key={mode.value}
                  onClick={() => {
                    onChange({ mode: mode.value });
                  }}
                  type="button"
                >
                  <span className="block text-sm font-semibold text-[var(--site-text)]">
                    {mode.label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[var(--site-muted)]">
                    {mode.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid content-start gap-4">
          <label className="block text-sm font-medium text-[var(--site-text)]">
            จำนวนบ้านที่แสดง
            <input
              className="mt-3 h-14 w-full rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-base text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
              max={12}
              min={1}
              onChange={(event) => {
                onChange({ limitCount: Number(event.target.value) });
              }}
              type="number"
              value={section.limitCount}
            />
            <span className="mt-2 block text-xs leading-5 text-[var(--site-muted)]">
              แสดงบ้านพักได้ 1-12 หลัง
            </span>
          </label>
        </div>
        <div className="grid gap-1">
          <label className="items-center font-semibold text-[var(--site-text)]">
            <input
              checked={
                normalizeAdminFallbackMode(section.fallbackMode) ===
                "fill_from_all"
              }
              className="size-5 shrink-0 accent-[var(--site-primary)]"
              onChange={(event) => {
                onChange({
                  fallbackMode: event.target.checked ? "fill_from_all" : "none",
                });
              }}
              type="checkbox"
            />
            <span className="ml-3">เติมจากบ้านพักทั้งหมดถ้าไม่ครบ</span>
          </label>
          <label className="items-center font-semibold text-[var(--site-text)]">
            <input
              checked={section.ctaEnabled}
              className="size-5 shrink-0 accent-[var(--site-primary)]"
              onChange={(event) => {
                const isEnabled = event.target.checked;

                onChange({
                  ctaEnabled: isEnabled,
                  ctaHref: isEnabled ? "/search" : section.ctaHref,
                  ctaLabel: isEnabled ? "ดูเพิ่มเติม" : section.ctaLabel,
                });
              }}
              type="checkbox"
            />
            <span className="ml-2">แสดงปุ่มดูเพิ่มเติมท้ายชุดนี้</span>
          </label>
        </div>
      </div>
    </>
  );
}
