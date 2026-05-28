import { CheckCircle2, Plus, Save } from "lucide-react";

interface AdminSectionsHeaderProps {
  activeSectionsCount: number;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onAddSection: () => void;
  onSave: () => void;
  sectionsCount: number;
};

export function AdminSectionsHeader({
  activeSectionsCount,
  hasUnsavedChanges,
  isLoading,
  isSaving,
  onAddSection,
  onSave,
  sectionsCount,
}: AdminSectionsHeaderProps) {
  return (
    <header className="grid gap-4 border-b border-[#d9e5df] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#0f6b52]">หน้าแรก</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal text-[#063f35]">
          จัดชุดบ้านพักหน้าแรก
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#58736b]">
          เลือก ลำดับ และจำนวนบ้านพักที่จะขึ้นบนหน้าแรกของเว็บไซต์
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white px-3 py-1.5 text-[#244a41] ring-1 ring-[#d9e5df]">
            ทั้งหมด {sectionsCount} ชุด
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-[#244a41] ring-1 ring-[#d9e5df]">
            เปิดใช้ {activeSectionsCount} ชุด
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
              hasUnsavedChanges
                ? "bg-[#fff7d6] text-[#7c4a03] ring-[#f4df93]"
                : "bg-white text-[#244a41] ring-[#d9e5df]"
            }`}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            {hasUnsavedChanges ? "มีรายการยังไม่บันทึก" : "บันทึกแล้ว"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#cddbd4] bg-white px-4 text-sm font-semibold text-[#0f4c3e] transition hover:bg-[#f2f7f4] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAddSection}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          เพิ่มชุดบ้านพัก
        </button>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#064e3b] px-4 text-sm font-semibold text-white transition hover:bg-[#0b5f49] disabled:cursor-not-allowed disabled:bg-[#b7c8c0] disabled:text-white/80"
          disabled={isSaving || isLoading || !hasUnsavedChanges}
          onClick={onSave}
          type="button"
        >
          <Save aria-hidden="true" className="size-4" />
          {isSaving
            ? "กำลังตรวจและบันทึก..."
            : hasUnsavedChanges
              ? "บันทึกหน้าแรก"
              : "บันทึกแล้ว"}
        </button>
      </div>
    </header>
  );
}
