"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import Link from "next/link";
import type { AdminAdvertisement } from "@/lib/advertisements/types";
import { ADVERTISEMENT_ZONES } from "@/lib/advertisements/validation";
import { AdvertisementImagesEditor, type DraftImage } from "./advertisement-images-editor";

export type AdvertisementEditorDraft = Omit<AdminAdvertisement, "updatedAt" | "images"> & {
  updatedAt: string | null;
  images: DraftImage[];
};

const inputClass = "h-9 w-full min-w-0 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-base focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/20 sm:text-sm";

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
    <form aria-label="ฟอร์มโฆษณา" onSubmit={onSave} className="mx-auto grid w-full max-w-[840px] min-w-0 gap-4">
      <header className="grid min-w-0 justify-items-start gap-1">
        <button type="button" aria-label="กลับรายการโฆษณา" disabled={disabled} onClick={onBack}
          className="inline-flex min-h-7 items-center gap-1.5 rounded text-xs text-[var(--site-muted)] hover:text-[var(--site-text)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40 pointer-coarse:min-h-11">
          <ArrowLeft aria-hidden="true" className="size-3.5" />กลับรายการ
        </button>
        <h1 ref={heading} tabIndex={-1} className="min-w-0 text-xl font-medium outline-none">{editor.updatedAt ? "แก้ไขโฆษณา" : "เพิ่มโฆษณา"}</h1>
      </header>
      {feedback}
      <fieldset disabled={disabled} className="min-w-0 divide-y divide-[var(--site-border)] rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
        <section className="grid gap-3 p-4 sm:p-5" aria-label="ข้อมูลโฆษณา">
          <label className="grid gap-1 text-xs font-medium">ชื่อโฆษณา<input name="title" maxLength={160} required className={inputClass} value={editor.title} onChange={event => onChange({ title: event.target.value })} /></label>
          <div className="grid grid-cols-[minmax(0,1fr)_80px] items-end gap-4">
            <label className="grid min-w-0 gap-1 text-xs font-medium">โซนที่แสดง<select className={inputClass} value={editor.zone} onChange={event => onChange({ zone: event.target.value })}>{ADVERTISEMENT_ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-medium">ลำดับ<input type="number" min={0} max={9999} required className={inputClass} value={editor.sortOrder} onChange={event => onChange({ sortOrder: Number(event.target.value) })} /></label>
          </div>
          <label className="flex min-h-7 items-center gap-2 text-xs pointer-coarse:min-h-11"><input type="checkbox" checked={editor.isActive} onChange={event => onChange({ isActive: event.target.checked })} className="size-4 accent-[var(--site-primary)]" />เปิดแสดงบนเว็บไซต์</label>
        </section>
        <AdvertisementImagesEditor images={editor.images} disabled={disabled} onChange={onImages} onError={onError} onObjectUrl={onObjectUrl} />
      </fieldset>
      <footer className="flex min-w-0 flex-wrap items-center gap-2" aria-label="บันทึกหรือยกเลิก">
        <button type="submit" disabled={disabled} aria-label={disabled ? "กำลังบันทึก…" : "บันทึกโฆษณา"}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-medium text-[var(--site-on-primary)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40 pointer-coarse:min-h-11">
          <Check aria-hidden="true" className="size-4" />{disabled ? "กำลังบันทึก…" : "บันทึกโฆษณา"}
        </button>
        <button type="button" disabled={disabled} onClick={onBack} className="min-h-10 rounded-md px-3 text-sm text-[var(--site-muted)] hover:bg-[var(--site-surface-tint)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40 pointer-coarse:min-h-11">ยกเลิก</button>
        {((dirty && !disabled) || notice) && <span role="status" className={`text-xs ${notice ? "text-emerald-700" : "text-[var(--site-muted)]"}`}>{notice ?? "ยังไม่บันทึก"}</span>}
      </footer>
      <div className="flex items-start justify-between gap-3 text-[11px] text-[var(--site-muted)]">
        <Link href="/admin/detail-layout" prefetch={false} className="py-2 underline-offset-4 hover:underline">ตั้งชื่อหัวข้อและตำแหน่งในหน้ารายละเอียด</Link>
        {editor.updatedAt && <button type="button" disabled={disabled} onClick={onDelete} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2 text-xs text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-40"><Trash2 aria-hidden="true" className="size-3.5" />ลบโฆษณา</button>}
      </div>
    </form>
  );
}
