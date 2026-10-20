"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedIndex = Math.max(0, images.findIndex(image => image.key === selectedKey));
  const selected = images[selectedIndex];
  function move(destination: number) {
    if (disabled || !selected || destination < 0 || destination >= images.length) return;
    const next = [...images];
    next.splice(selectedIndex, 1);
    next.splice(destination, 0, selected);
    setSelectedKey(selected.key);
    onChange(next);
  }
  return (
    <section aria-label="รูปโฆษณา" className="min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">รูปโฆษณา <span className="ml-2 text-xs font-normal text-[var(--site-muted)]">{images.length}/{ADVERTISEMENT_IMAGE_LIMIT}</span></h2>
        <button type="button" disabled={disabled || images.length >= ADVERTISEMENT_IMAGE_LIMIT} onClick={() => input.current?.click()} className={`${actionClass} border border-[var(--site-border-strong)]`}><Plus aria-hidden="true" className="size-4" />เพิ่มรูป</button>
        <input ref={input} aria-label="เพิ่มรูปโฆษณา" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || images.length >= ADVERTISEMENT_IMAGE_LIMIT} className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!files.length) return;
            const errors = files.flatMap(validateAdvertisementUpload);
            if (images.length + files.length > ADVERTISEMENT_IMAGE_LIMIT) errors.push(`เลือกรูปได้สูงสุด ${ADVERTISEMENT_IMAGE_LIMIT} รูป`);
            if (errors.length) { onError([...new Set(errors)]); return; }
            onChange([...images, ...files.map(file => {
              const url = URL.createObjectURL(file);
              onObjectUrl(url);
              return { key: crypto.randomUUID(), file, url };
            })]);
          }}
        />
      </div>
      {images.length === 0 && <p className="rounded-md bg-[var(--site-surface-soft)] px-4 py-8 text-center text-sm text-[var(--site-muted)]">เพิ่มรูปอย่างน้อย 1 รูป</p>}
      <ol className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-[repeat(auto-fill,minmax(100px,112px))] sm:gap-3">
        {images.map((image, index) => (
          <li key={image.key} className="grid min-w-0 content-start gap-1.5">
            <button type="button" aria-label={`เลือกรูปที่ ${index + 1}`} aria-pressed={index === selectedIndex} disabled={disabled} onClick={() => setSelectedKey(image.key)}
              className={`min-w-0 rounded-md border p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-50 ${index === selectedIndex ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] ring-1 ring-[var(--site-primary)]" : "border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-border-strong)]"}`}>
              <CspSafeImage src={image.url} alt={`รูปโฆษณาที่ ${index + 1}`} width={112} height={76} className="h-[68px] w-full rounded-sm object-cover sm:h-[76px]" unoptimized />
            </button>
            <span className={`truncate text-center text-xs ${index === selectedIndex ? "text-[var(--site-primary)]" : "text-[var(--site-muted)]"}`}>{index === 0 ? "ภาพปก" : `รูปที่ ${index + 1}`}</span>
            {image.file && <span className="text-center text-[11px] text-[var(--site-muted)]">ยังไม่อัปโหลด</span>}
          </li>
        ))}
      </ol>
      <div role="group" aria-label="จัดการรูปที่เลือก" className="mt-4 flex flex-wrap items-center gap-1 border-t border-[var(--site-border)] pt-3">
        <span role="status" className="mr-auto basis-full pb-1 text-xs text-[var(--site-muted)] sm:basis-auto sm:pb-0">{selected ? `เลือกรูปที่ ${selectedIndex + 1}${selectedIndex === 0 ? " · ภาพปก" : ""}` : "ยังไม่มีรูป"}</span>
        <button type="button" aria-label="เลื่อนรูปไปก่อนหน้า" disabled={disabled || !selected || selectedIndex === 0} onClick={() => move(selectedIndex - 1)} className={`${actionClass} w-9 px-0 pointer-coarse:min-w-11`}><ArrowLeft aria-hidden="true" className="size-4" /></button>
        <button type="button" aria-label="เลื่อนรูปไปถัดไป" disabled={disabled || !selected || selectedIndex === images.length - 1} onClick={() => move(selectedIndex + 1)} className={`${actionClass} w-9 px-0 pointer-coarse:min-w-11`}><ArrowRight aria-hidden="true" className="size-4" /></button>
        <button type="button" disabled={disabled || !selected || selectedIndex === 0} onClick={() => move(0)} className={`${actionClass} border border-[var(--site-border-strong)]`}>ตั้งเป็นภาพปก</button>
        <button type="button" disabled={disabled || !selected} onClick={() => {
          setSelectedKey(images[selectedIndex + 1]?.key ?? images[selectedIndex - 1]?.key ?? null);
          onChange(images.filter(image => image.key !== selected.key));
        }} className={`${actionClass} ml-auto sm:ml-1`}><Trash2 aria-hidden="true" className="size-4" />ลบรูป</button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[var(--site-muted)]">เลือกรูปเพื่อจัดลำดับหรือลบ · JPG, PNG, WebP ไม่เกินรูปละ 6 MB · อัปโหลดเมื่อบันทึก</p>
    </section>
  );
}
