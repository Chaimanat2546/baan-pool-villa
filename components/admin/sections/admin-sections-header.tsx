import { CheckCircle2, Eye, Plus, Save } from "lucide-react";
import Link from "next/link";

interface AdminSectionsHeaderProps {
  activeSectionsCount: number;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onAddSection: () => void;
  onSave: () => void;
  sectionsCount: number;
}

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
    <header className="grid gap-4 border-b border-[var(--site-border)] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-primary)]">หน้าแรก</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--site-text)]">
          จัดชุดบ้านพักหน้าแรก
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
          เลือก ลำดับ และจำนวนบ้านพักที่จะขึ้นบนหน้าแรกของเว็บไซต์
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
            ทั้งหมด {sectionsCount} ชุด
          </span>
          <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
            เปิดใช้ {activeSectionsCount} ชุด
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
              hasUnsavedChanges
                ? "bg-[var(--site-primary-soft)] text-[var(--site-text)] ring-[var(--site-primary)]"
                : "bg-[var(--site-surface)] text-[var(--site-text)] ring-[var(--site-border)]"
            }`}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            {hasUnsavedChanges ? "มีรายการยังไม่บันทึก" : "บันทึกแล้ว"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAddSection}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          เพิ่มชุดบ้านพัก
        </button>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
          href="/"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Eye aria-hidden="true" className="size-4" />
          ดูหน้าเว็บจริง
        </Link>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80"
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
