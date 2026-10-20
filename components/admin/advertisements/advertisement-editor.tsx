"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import type { AdminAdvertisement } from "@/lib/advertisements/types";
import { ADVERTISEMENT_ZONES } from "@/lib/advertisements/validation";
import { AdvertisementImagesEditor, type DraftImage } from "./advertisement-images-editor";

export type AdvertisementEditorDraft = Omit<AdminAdvertisement, "updatedAt" | "images"> & {
  updatedAt: string | null;
  images: DraftImage[];
};

const inputClass = "h-10 w-full min-w-0 rounded-lg border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/20";

export function AdvertisementEditor({ editor, dirty, disabled, notice, feedback, onChange, onImages, onObjectUrl, onError, onSave, onBack, onDelete }: {
  editor: AdvertisementEditorDraft;
  dirty: boolean;
  disabled: boolean;
  notice: string | null;
  feedback: ReactNode;
  onChange: (changes: Partial<AdvertisementEditorDraft>) => void;
  onImages: (images: DraftImage[]) => void;
  onObjectUrl: (url: string) => void;
  onError: (errors: string[]) => void;
  onSave: (event: FormEvent) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <form onSubmit={onSave} className="mx-auto grid w-full max-w-[920px] min-w-0 gap-3">
      <header className="sticky top-20 z-20 flex h-12 min-w-0 items-center gap-2 border-b border-[var(--site-border)] bg-[var(--site-surface)] px-2 lg:top-4">
        <button
          type="button" aria-label="กลับรายการโฆษณา" title="กลับรายการ"
          disabled={disabled} onClick={onBack}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded px-1 text-xs hover:bg-[var(--site-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">กลับรายการ</span>
        </button>
        <h1 ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate text-sm font-bold outline-none">
          {editor.updatedAt ? "แก้ไขโฆษณา" : "เพิ่มโฆษณา"}
        </h1>
        {((dirty && !disabled) || notice) && (
          <span role="status" className={`shrink-0 whitespace-nowrap text-[11px] ${notice ? "text-emerald-700" : "text-[var(--site-muted)]"}`}>
            {notice ?? "ยังไม่บันทึก"}
          </span>
        )}
        <button
          type="submit" disabled={disabled}
          aria-label={disabled ? "กำลังบันทึก…" : "บันทึกโฆษณา"}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--site-primary)] px-2.5 text-sm font-semibold text-[var(--site-on-primary)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40"
        >
          <Save className="size-4" />
          {disabled ? "กำลังบันทึก…" : <span>บันทึก<span className="hidden sm:inline">โฆษณา</span></span>}
        </button>
      </header>
      {feedback}
      <fieldset disabled={disabled} className="grid min-w-0 gap-4 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <label className="grid gap-1.5 text-sm font-semibold">ชื่อโฆษณา<input name="title" maxLength={160} required className={inputClass} value={editor.title} onChange={(event) => onChange({ title: event.target.value })} /></label>
        <div className="grid grid-cols-[minmax(0,1fr)_100px] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
          <label className="grid min-w-0 gap-1.5 text-sm font-semibold">โซนที่แสดง<select className={inputClass} value={editor.zone} onChange={(event) => onChange({ zone: event.target.value })}>{ADVERTISEMENT_ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold">ลำดับ<input type="number" min={0} max={9999} required className={inputClass} value={editor.sortOrder} onChange={(event) => onChange({ sortOrder: Number(event.target.value) })} /></label>
          <label className="col-span-2 flex min-h-10 items-center gap-2 text-sm font-semibold sm:col-span-1"><input type="checkbox" checked={editor.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} className="size-4 accent-[var(--site-primary)]" />เปิดแสดงบนเว็บไซต์</label>
        </div>
        <p className="text-xs text-[var(--site-muted)]">เลขน้อยแสดงก่อน · แสดงตามโซนของบ้านและรายการทุกโซน</p>
        <AdvertisementImagesEditor images={editor.images} disabled={disabled} onChange={onImages} onError={onError} onObjectUrl={onObjectUrl} />
      </fieldset>
      {editor.updatedAt && <div className="flex justify-end"><button type="button" disabled={disabled} onClick={onDelete} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-40"><Trash2 className="size-3.5" />ลบโฆษณา</button></div>}
    </form>
  );
}
