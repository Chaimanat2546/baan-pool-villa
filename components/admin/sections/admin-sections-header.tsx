import { CheckCircle2, LogOut, Plus, Save } from "lucide-react";

type AdminSectionsHeaderProps = {
  activeSectionsCount: number;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onAddSection: () => void;
  onLogout: () => void;
  onSave: () => void;
  sectionsCount: number;
};

export function AdminSectionsHeader({
  activeSectionsCount,
  hasUnsavedChanges,
  isLoading,
  isSaving,
  onAddSection,
  onLogout,
  onSave,
  sectionsCount,
}: AdminSectionsHeaderProps) {
  return (
    <header className="rounded-[24px] bg-[#064e3b] p-4 text-white shadow-[0_18px_48px_rgba(6,63,53,0.16)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#facc15]">
            หลังบ้านหน้าแรก
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            จัดชุดบ้านพักหน้าแรก
          </h1>
          <p className="mt-1 text-sm text-emerald-50">
            เลือกและเรียงชุดบ้านพักที่แสดงบนหน้าแรกของเว็บไซต์
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#064e3b] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onAddSection}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มชุดบ้านพัก
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#facc15] px-4 text-sm font-semibold text-[#063f35] transition hover:bg-[#fde047] disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70"
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
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={onLogout}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4" />
            ออกจากระบบ
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-white/12 px-3 py-1.5 text-white">
          ทั้งหมด {sectionsCount} ชุด
        </span>
        <span className="rounded-full bg-white/12 px-3 py-1.5 text-white">
          เปิดใช้ {activeSectionsCount} ชุด
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            hasUnsavedChanges
              ? "bg-[#fef3c7] text-[#7c4a03]"
              : "bg-white/12 text-white"
          }`}
        >
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
          {hasUnsavedChanges ? "มีการแก้ไขยังไม่บันทึก" : "บันทึกแล้ว"}
        </span>
      </div>
    </header>
  );
}
