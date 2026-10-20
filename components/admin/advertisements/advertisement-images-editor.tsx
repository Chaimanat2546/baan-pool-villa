"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { CspSafeImage } from "@/components/ui/csp-safe-image";
import { ADVERTISEMENT_IMAGE_LIMIT } from "@/lib/advertisements/types";
import { validateAdvertisementUpload } from "@/lib/advertisements/validation";

export interface DraftImage {
  key: string;
  id?: string;
  url: string;
  file?: File;
}

const actionClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-2.5 text-xs hover:bg-[var(--site-surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-35 pointer-coarse:min-h-11";

export function AdvertisementImagesEditor({ images, disabled, onChange, onError, onObjectUrl }: {
  images: DraftImage[];
  disabled: boolean;
  onChange: (images: DraftImage[]) => void;
  onError: (errors: string[]) => void;
  onObjectUrl: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedIndex = Math.max(0, images.findIndex(image => image.key === selectedKey));
  const selected = images[selectedIndex];
  const canAdd = images.length < ADVERTISEMENT_IMAGE_LIMIT;
  const highlightDrop = isDragging && !disabled && canAdd;
  function addFiles(files: File[]) {
    if (disabled || !files.length) return;
    const errors = files.flatMap(validateAdvertisementUpload);
    if (images.length + files.length > ADVERTISEMENT_IMAGE_LIMIT) errors.push(`เลือกรูปได้สูงสุด ${ADVERTISEMENT_IMAGE_LIMIT} รูป`);
    if (errors.length) { onError([...new Set(errors)]); return; }
    onError([]);
    onChange([...images, ...files.map(file => {
      const url = URL.createObjectURL(file);
      onObjectUrl(url);
      return { key: crypto.randomUUID(), file, url };
    })]);
  }
  function move(destination: number) {
    if (disabled || !selected || destination < 0 || destination >= images.length) return;
    const next = [...images];
    next.splice(selectedIndex, 1);
    next.splice(destination, 0, selected);
    setSelectedKey(selected.key);
    onChange(next);
  }
  return (
    <section aria-label="รูปโฆษณา" className={`min-w-0 rounded-b-lg p-4 transition-colors sm:p-5 ${highlightDrop ? "bg-[var(--site-primary-soft)] ring-2 ring-[var(--site-primary)] ring-inset" : ""}`}
      onDragEnter={event => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={event => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled || !canAdd ? "none" : "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={event => {
        if (!Array.from(event.dataTransfer.types).includes("Files") && !event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setIsDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-medium">รูปโฆษณา <span className="ml-2 text-xs font-normal text-[var(--site-muted)]">{images.length}/{ADVERTISEMENT_IMAGE_LIMIT}</span></h2>
        <input ref={input} aria-label="เพิ่มรูปโฆษณา" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || images.length >= ADVERTISEMENT_IMAGE_LIMIT} className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            addFiles(files);
          }}
        />
      </div>
      {images.length > ADVERTISEMENT_IMAGE_LIMIT && <p role="alert" className="mb-3 text-xs text-red-700">มีรูปเกินกำหนด กรุณาลดให้เหลือไม่เกิน {ADVERTISEMENT_IMAGE_LIMIT} รูปก่อนบันทึก</p>}
      <ol className="flex min-w-0 flex-wrap items-start gap-3">
        {images.map((image, index) => (
          <li key={image.key} className="grid w-28 min-w-0 content-start gap-1.5">
            <button type="button" aria-label={`เลือกรูปที่ ${index + 1}`} aria-pressed={index === selectedIndex} disabled={disabled} onClick={() => setSelectedKey(image.key)}
              className={`min-w-0 rounded-md border p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-50 ${index === selectedIndex ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] ring-1 ring-[var(--site-primary)]" : "border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-border-strong)]"}`}>
              <CspSafeImage src={image.url} alt={`รูปโฆษณาที่ ${index + 1}`} width={112} height={76} className="h-[68px] w-full rounded-sm object-cover sm:h-[76px]" draggable={false} unoptimized />
            </button>
            <span className={`truncate text-center text-xs ${index === selectedIndex ? "text-[var(--site-primary)]" : "text-[var(--site-muted)]"}`}>{index === 0 ? "ภาพปก" : `รูปที่ ${index + 1}`}</span>
            {image.file && <span className="text-center text-[11px] text-[var(--site-muted)]">ยังไม่อัปโหลด</span>}
          </li>
        ))}
        {canAdd && <li className={`max-w-full ${images.length ? "w-36" : "w-64"}`}>
          <button type="button" aria-label="เลือกไฟล์หรือลากรูปมาวาง" disabled={disabled} onClick={() => input.current?.click()}
            className={`flex min-h-[86px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40 ${highlightDrop ? "border-[var(--site-primary)]" : "border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] hover:border-[var(--site-primary)]"}`}>
            <Upload aria-hidden="true" className="size-4 shrink-0 text-[var(--site-muted)]" />
            <span>ลากรูปมาวาง หรือ <span className="underline underline-offset-2">เลือกไฟล์</span></span>
            {images.length === 0 && <span className="text-[11px] text-[var(--site-muted)]">เพิ่มรูปอย่างน้อย 1 รูป</span>}
          </button>
        </li>}
      </ol>
      {selected && <div role="group" aria-label="จัดการรูปที่เลือก" className="mt-2 flex flex-wrap items-center gap-1">
        <span role="status" className="sr-only">{`เลือกรูปที่ ${selectedIndex + 1}${selectedIndex === 0 ? " · ภาพปก" : ""}`}</span>
        <button type="button" aria-label="เลื่อนรูปไปก่อนหน้า" disabled={disabled || !selected || selectedIndex === 0} onClick={() => move(selectedIndex - 1)} className={`${actionClass} w-9 px-0 pointer-coarse:min-w-11`}><ArrowLeft aria-hidden="true" className="size-4" /></button>
        <button type="button" aria-label="เลื่อนรูปไปถัดไป" disabled={disabled || !selected || selectedIndex === images.length - 1} onClick={() => move(selectedIndex + 1)} className={`${actionClass} w-9 px-0 pointer-coarse:min-w-11`}><ArrowRight aria-hidden="true" className="size-4" /></button>
        <button type="button" disabled={disabled || !selected || selectedIndex === 0} onClick={() => move(0)} className={`${actionClass} border border-[var(--site-border-strong)]`}>ตั้งเป็นภาพปก</button>
        <button type="button" disabled={disabled || !selected} onClick={() => {
          setSelectedKey(images[selectedIndex + 1]?.key ?? images[selectedIndex - 1]?.key ?? null);
          onChange(images.filter(image => image.key !== selected.key));
        }} className={`${actionClass} ml-1`}><Trash2 aria-hidden="true" className="size-4" />ลบรูป</button>
      </div>}
      <p className="mt-2 text-[11px] leading-5 text-[var(--site-muted)]">สูงสุด {ADVERTISEMENT_IMAGE_LIMIT} รูป · JPG, PNG, WebP ไม่เกินรูปละ 6 MB · อัปโหลดเมื่อบันทึก</p>
    </section>
  );
}
