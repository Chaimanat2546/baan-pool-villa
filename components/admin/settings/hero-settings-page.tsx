"use client";

import { ChevronDown, ChevronUp, GripVertical, ImageUp, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { validateUploadMetadata } from "@/lib/site-settings/validation";
import { SectionCard, TextControl } from "./settings-form-controls";
import { addHeroSlide, buildHeroSettingsFormData, getSafePreviewImageUrl, makeHeroSettingsSnapshot, mapHeroSettingsResponse, moveHeroSlide, removeHeroSlide, reorderHeroSlides } from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { validateHeroSettingsDraft } from "./settings-validation";
import type { HeroSlideDraft } from "./types";
import { useAdminSettingsSection } from "./use-admin-settings-section";

function HeroSlideImage({ file, image, index, onFileChange }: { file: File | null; image: HeroSlideDraft["image"]; index: number; onFileChange: (file: File | null) => void }) {
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  const previewUrl = objectUrl ?? getSafePreviewImageUrl(image.url, "/images/BPV-66_Cover-Web.jpg");
  const id = `heroSlideFile-${index}`;

  return <div className="grid gap-2">
    <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)]">
      <Image alt={image.alt || `ตัวอย่างสไลด์ ${index + 1}`} className="object-cover" fill sizes="(max-width: 640px) 100vw, 160px" src={previewUrl} />
    </div>
    <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]" htmlFor={id}>
      <ImageUp aria-hidden="true" className="size-4" />{file ? "เปลี่ยนรูป" : "เลือกรูป"}
    </label>
    <input accept="image/jpeg,image/png,image/webp" className="sr-only" id={id} onChange={(event) => {
      const nextFile = event.target.files?.[0] ?? null;
      if (!nextFile) { setFileErrors([]); onFileChange(null); return; }
      const errors = validateUploadMetadata("hero", nextFile.type, nextFile.size, nextFile.name);
      setFileErrors(errors);
      if (errors.length) { event.currentTarget.value = ""; onFileChange(null); return; }
      onFileChange(nextFile);
    }} type="file" />
    {fileErrors.length ? <p className="text-xs font-medium text-red-700" role="alert">{fileErrors[0]}</p> : null}
  </div>;
}

export function HeroSettingsPage() {
  const state = useAdminSettingsSection({ section: "hero", mapResponse: mapHeroSettingsResponse, makeSnapshot: makeHeroSettingsSnapshot, buildRequest: (draft) => ({ body: buildHeroSettingsFormData(draft) }), validate: validateHeroSettingsDraft });
  const { draft } = state;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const updateSlide = (index: number, changes: Partial<HeroSlideDraft>) => state.updateDraft({ heroSlides: draft ? draft.heroSlides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...changes } : slide) : [] });
  const moveSlide = (index: number, direction: -1 | 1) => state.updateDraft({ heroSlides: draft ? moveHeroSlide(draft.heroSlides, index, direction) : [] });

  return <div className="grid gap-5">
    <SettingsSectionHeader title="สไลด์รูปหน้าแรก" description="จัดการรูป Hero ได้สูงสุด 10 รูป แต่ละรูปมีคำอธิบายและลำดับของตัวเอง" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <SectionCard action={<button aria-label="เพิ่มสไลด์" className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={draft.heroSlides.length >= 10} onClick={() => state.updateDraft({ heroSlides: addHeroSlide(draft.heroSlides) })} type="button"><Plus aria-hidden="true" className="size-4" />เพิ่มสไลด์</button>} description={`เรียงลำดับและแก้ไขข้อความอธิบายของแต่ละรูป (${draft.heroSlides.length}/10)`} icon={<LayoutTemplate aria-hidden="true" className="size-5" />} id="hero" title="สไลด์ Hero">
      <ol className="grid gap-3">
        {draft.heroSlides.map((slide, index) => <li className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 sm:grid-cols-[auto_160px_minmax(0,1fr)_auto] sm:items-start" key={slide.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex !== null) state.updateDraft({ heroSlides: reorderHeroSlides(draft.heroSlides, draggedIndex, index) }); setDraggedIndex(null); }}>
          <div className="flex items-center gap-2 pt-1 text-[var(--site-muted)]"><button aria-label={`ลากเพื่อเรียงสไลด์ที่ ${index + 1}`} className="cursor-grab touch-none active:cursor-grabbing" draggable onDragEnd={() => setDraggedIndex(null)} onDragStart={() => setDraggedIndex(index)} type="button"><GripVertical aria-hidden="true" className="size-5" /></button><span className="rounded-full bg-[var(--site-primary-soft)] px-2 py-1 text-xs font-bold text-[var(--site-primary)]">สไลด์ {index + 1}</span></div>
          <HeroSlideImage file={slide.file} image={slide.image} index={index} onFileChange={(file) => updateSlide(index, { file })} />
          <TextControl id={`heroSlideAlt-${index}`} label="คำอธิบายรูป" description="จำเป็นสำหรับการเข้าถึงและเมื่อโหลดรูปไม่สำเร็จ" maxLength={160} onChange={(alt) => updateSlide(index, { image: { ...slide.image, alt } })} placeholder="ภาพบ้านพักพูลวิลล่าที่พัทยา" value={slide.image.alt} />
          <div className="flex gap-1 sm:flex-col"><button aria-label={`เลื่อนสไลด์ที่ ${index + 1} ขึ้น`} className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] disabled:cursor-not-allowed disabled:opacity-40" disabled={index === 0} onClick={() => moveSlide(index, -1)} type="button"><ChevronUp aria-hidden="true" className="size-4" /></button><button aria-label={`เลื่อนสไลด์ที่ ${index + 1} ลง`} className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] disabled:cursor-not-allowed disabled:opacity-40" disabled={index === draft.heroSlides.length - 1} onClick={() => moveSlide(index, 1)} type="button"><ChevronDown aria-hidden="true" className="size-4" /></button><button aria-label={`ลบสไลด์ที่ ${index + 1}`} className="inline-flex size-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={draft.heroSlides.length <= 1} onClick={() => state.updateDraft({ heroSlides: removeHeroSlide(draft.heroSlides, index) })} type="button"><Trash2 aria-hidden="true" className="size-4" /></button></div>
        </li>)}
      </ol>
    </SectionCard> : null}
  </div>;
}
