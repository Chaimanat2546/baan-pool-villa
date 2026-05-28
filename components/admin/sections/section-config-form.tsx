import type { AdminSectionDraft } from "./types";
import {
  getFallbackExplanation,
  MODE_OPTIONS,
  normalizeAdminFallbackMode,
} from "./section-helpers";

type SectionConfigFormProps = {
  onChange: (changes: Partial<Omit<AdminSectionDraft, "draftId">>) => void;
  section: AdminSectionDraft;
};

export function SectionConfigForm({
  onChange,
  section,
}: SectionConfigFormProps) {
  return (
    <>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)]">
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-[#173f36]">
            รูปแบบการเลือกบ้าน
          </legend>
          <div className="mt-3 grid gap-3">
            {MODE_OPTIONS.map((mode) => {
              const isSelected = section.mode === mode.value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-20 rounded-xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[#2f7cff] bg-[#eef5ff] text-[#0f335f] shadow-[0_0_0_1px_rgba(47,124,255,0.3)]"
                      : "border-[#dbe1e7] bg-white text-[#55746b] hover:bg-[#f8fbf7]"
                  }`}
                  key={mode.value}
                  onClick={() => onChange({ mode: mode.value })}
                  type="button"
                >
                  <span className="block text-sm font-semibold text-[#173f36]">
                    {mode.label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#52656f]">
                    {mode.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid content-start gap-4">
          <label className="block text-sm font-medium text-[#173f36]">
            จำนวนบ้านที่แสดง
            <input
              className="mt-3 h-14 w-full rounded-xl border border-[#dbe1e7] bg-white px-4 text-base text-[#173f36] outline-none transition focus:border-[#2f7cff] focus:ring-2 focus:ring-[#2f7cff]/15"
              max={12}
              min={1}
              onChange={(event) =>
                onChange({ limitCount: Number(event.target.value) })
              }
              type="number"
              value={section.limitCount}
            />
            <span className="mt-2 block text-xs leading-5 text-[#687d76]">
              แสดงบ้านพักได้ 1-12 หลัง
            </span>
          </label>

          <label className="flex min-h-16 items-center rounded-xl border border-[#dbe1e7] bg-[#fbfcfd] px-4 py-3 text-sm font-semibold text-[#173f36]">
            <input
              checked={
                normalizeAdminFallbackMode(section.fallbackMode) ===
                "fill_from_all"
              }
              className="size-5 shrink-0 accent-[#075341]"
              onChange={(event) =>
                onChange({
                  fallbackMode: event.target.checked
                    ? "fill_from_all"
                    : "none",
                })
              }
              type="checkbox"
            />
            <span className="ml-3">เติมจากบ้านพักทั้งหมดถ้าไม่ครบ</span>
          </label>
          <p className="text-xs leading-5 text-[#687d76]">
            {getFallbackExplanation(section)}
          </p>
        </div>
      </div>

      <label className="flex h-12 items-center rounded-xl border border-[#dbe1e7] bg-[#fbfcfd] px-4 py-2 text-sm font-semibold text-[#173f36]">
        <input
          checked={section.ctaEnabled}
          className="size-5 shrink-0 accent-[#075341]"
          onChange={(event) => {
            const isEnabled = event.target.checked;

            onChange({
              ctaEnabled: isEnabled,
              ctaHref:
                isEnabled && !section.ctaHref.trim()
                  ? "/search"
                  : section.ctaHref,
              ctaLabel:
                isEnabled && !section.ctaLabel.trim()
                  ? "ดูเพิ่มเติม"
                  : section.ctaLabel,
            });
          }}
          type="checkbox"
        />
        <span className="ml-2">แสดงปุ่มดูเพิ่มเติม</span>
      </label>

      <details className="rounded-xl border border-[#dbe1e7] bg-white px-4 text-sm">
        <summary className="cursor-pointer py-3 font-semibold text-[#173f36]">
          ตั้งค่าขั้นสูง
        </summary>
        <div className="grid gap-3 pb-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-[#173f36]">
            รหัสชุดสำหรับระบบ
            <input
              className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
              onChange={(event) => onChange({ slug: event.target.value })}
              value={section.slug}
            />
          </label>
          <label className="block text-sm font-medium text-[#173f36]">
            เริ่มจากลำดับที่
            <input
              className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
              min={0}
              onChange={(event) =>
                onChange({ sliceOffset: Number(event.target.value) })
              }
              type="number"
              value={section.sliceOffset}
            />
          </label>
          <label className="block text-sm font-medium text-[#173f36]">
            ข้อความบนปุ่มดูเพิ่มเติม
            <input
              className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
              disabled={!section.ctaEnabled}
              onChange={(event) => onChange({ ctaLabel: event.target.value })}
              placeholder="ดูเพิ่มเติม"
              value={section.ctaLabel}
            />
          </label>
          <label className="block text-sm font-medium text-[#173f36]">
            ลิงก์ปุ่มดูเพิ่มเติม
            <input
              className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
              disabled={!section.ctaEnabled}
              onChange={(event) => onChange({ ctaHref: event.target.value })}
              placeholder="/search"
              value={section.ctaHref}
            />
          </label>
        </div>
      </details>
    </>
  );
}
