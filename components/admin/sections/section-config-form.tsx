import type { AdminSectionDraft } from "./types";
import {
  MODE_OPTIONS,
  normalizeAdminFallbackMode,
} from "./section-helpers";

interface SectionConfigFormProps {
  errors?: {
    limitCount?: string[];
  };
  onChange: (changes: Partial<Omit<AdminSectionDraft, "draftId">>) => void;
  section: AdminSectionDraft;
}

export function SectionConfigForm({
  errors = {},
  onChange,
  section,
}: SectionConfigFormProps) {
  const limitCountErrors = errors.limitCount ?? [];

  return (
    <div className="grid gap-4">
      <fieldset className="min-w-0">
        <legend className="sr-only">วิธีเลือกบ้านพัก</legend>
        <div className="grid gap-3 lg:grid-cols-3">
          {MODE_OPTIONS.map((mode) => {
            const isSelected = section.mode === mode.value;

            return (
              <button
                aria-pressed={isSelected}
                className={`min-h-24 rounded-lg border px-4 py-4 text-left transition ${
                  isSelected
                    ? "border-[var(--site-primary)] bg-[var(--site-surface-soft)]"
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

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          จำนวนบ้านสูงสุดที่แสดง
          <input
            aria-describedby={
              limitCountErrors.length > 0
                ? "admin-section-limit-count-error"
                : undefined
            }
            aria-invalid={limitCountErrors.length > 0}
            className={`mt-2 h-10 w-full rounded-md border bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition ${
              limitCountErrors.length > 0
                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                : "border-[var(--site-border)] focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            }`}
            min={1}
            onChange={(event) => {
              onChange({ limitCount: Number(event.target.value) });
            }}
            type="number"
            value={section.limitCount}
          />
          {limitCountErrors.length > 0 ? (
            <ul
              className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold leading-5 text-red-700"
              data-admin-section-field-error="limitCount"
              id="admin-section-limit-count-error"
            >
              {limitCountErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <span className="mt-2 block text-xs leading-5 text-[var(--site-muted)]">
            ใส่จำนวนสูงสุดที่ต้องการให้แสดง ระบบจะแสดงเท่าที่มีข้อมูลบ้านจริง
          </span>
        </label>
        <div className="grid gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
          <label className="flex items-center gap-3 text-sm font-semibold text-[var(--site-text)]">
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
            <span>เติมจากบ้านพักทั้งหมดถ้าไม่ครบ</span>
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-[var(--site-text)]">
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
            <span>แสดงปุ่มดูเพิ่มเติมท้ายชุดนี้</span>
          </label>
        </div>
      </div>
    </div>
  );
}
