"use client";

import { useState } from "react";
import { ImageOff, Upload, X } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { safeReviewImageUrl } from "@/components/villas/detail/villa-review-utils";
import type { AdminVillaReviewImage } from "@/lib/villa-reviews/types";

export interface QueuedReviewImage { file: File; objectUrl: string; error?: string; }

export function ReviewImagePreview({ url, alt, large = false }: { url: string; alt: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const safeUrl = url.startsWith("blob:") ? url : safeReviewImageUrl(url);
  return <span className={`relative grid w-full place-items-center overflow-hidden rounded-lg bg-[var(--site-surface-soft)] ${large ? "aspect-[4/3]" : "aspect-[16/10]"}`}>
    {failed || !safeUrl ? <span className="grid gap-1 p-2 text-center text-xs text-[var(--site-muted)]"><ImageOff className="mx-auto" size={22} aria-hidden="true" />โหลดรูปไม่ได้</span>
      : <Image alt={alt} src={safeUrl} fill unoptimized loading="lazy" sizes={large ? "320px" : "100px"} className={large ? "object-contain" : "object-cover"} onError={() => setFailed(true)} />}
  </span>;
}

export function ReviewImageManager({ images, queue, disabled, fieldErrors, onFiles, onRemoveRetained, onRemoveQueued, onPreview }: {
  images: AdminVillaReviewImage[]; queue: QueuedReviewImage[]; disabled: boolean; fieldErrors: Record<string, string>;
  onFiles: (files: File[]) => void; onRemoveRetained: (id: string) => void; onRemoveQueued: (index: number) => void; onPreview: (url: string) => void;
}) {
  return <section className="space-y-3" aria-label="จัดการรูปรีวิว">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-base font-semibold">รูปรีวิว</h3><p className="mt-1 text-xs text-[var(--site-muted)]">JPG, PNG, WebP · ไม่เกิน 5 MB ต่อรูป · รวมได้สูงสุด 5 รูป</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--site-border)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--site-surface-soft)]"><Upload aria-hidden="true" size={17} />เพิ่มรูปภาพ<input type="file" multiple disabled={disabled} accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {images.map((image, index) => <div className="relative min-w-0" key={image.id}>
        <button type="button" disabled={disabled} className="block w-full" aria-label={`เปิดดูรูปเดิม ${index + 1}`} onClick={() => onPreview(image.url)}><ReviewImagePreview url={image.url} alt={`รูปรีวิวเดิม ${index + 1}`} /></button>
        <button type="button" disabled={disabled} className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/70 text-white" aria-label={`นำรูปเดิม ${index + 1} ออก`} onClick={() => onRemoveRetained(image.id)}><X size={16} aria-hidden="true" /></button>
      </div>)}
      {queue.map((item, index) => <div key={item.objectUrl || `invalid-${index}`} className="relative min-w-0 rounded-lg border border-[var(--site-border)] p-2">
        {item.objectUrl ? <button type="button" disabled={disabled} className="block w-full" aria-label={`ดูรูปใหม่ ${item.file.name}`} onClick={() => onPreview(item.objectUrl)}><ReviewImagePreview url={item.objectUrl} alt={`รูปใหม่ ${item.file.name}`} /></button> : null}
        <p className="mt-1 truncate text-xs" title={item.file.name}>{item.file.name}</p>
        {item.error ? <p role="alert" className="mt-1 break-words text-xs text-red-700">{item.error}</p> : <p className="mt-1 text-xs text-[var(--site-muted)]">รอบันทึก</p>}
        <button type="button" disabled={disabled} aria-label={`นำ ${item.file.name} ออก`} className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/70 text-white" onClick={() => onRemoveQueued(index)}><X size={16} aria-hidden="true" /></button>
      </div>)}
    </div>
    {Object.entries(fieldErrors).filter(([key]) => key === "images" || key.startsWith("images.") || key === "retainedImageIds").map(([key, message]) => <p role="alert" key={key} className="break-words text-sm text-red-700">{message}</p>)}
    {!images.length && !queue.length ? <p className="text-xs text-[var(--site-muted)]">รีวิวนี้ไม่มีรูปภาพ</p> : null}
  </section>;
}
