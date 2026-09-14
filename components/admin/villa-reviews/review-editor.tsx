"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { GalleryLightbox } from "@/components/villas/detail/gallery-lightbox";
import { safeReviewImageUrl } from "@/components/villas/detail/villa-review-utils";
import type { GalleryItem } from "@/components/villas/detail/types";
import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEW_IMAGES, validateReviewFiles } from "@/lib/villa-reviews/input-validation";
import type { AdminVillaReviewDetail } from "@/lib/villa-reviews/types";
import { ReviewHistory } from "./review-history";
import { ReviewImageManager, ReviewImagePreview, type QueuedReviewImage } from "./review-image-manager";

export function ReviewEditor({ review, pending, error, fieldErrors, onSave, onDelete, onClose, showSecondary = true }: {
  review: AdminVillaReviewDetail; pending: boolean; error: string; fieldErrors: Record<string, string>;
  onSave: (form: FormData) => void; onDelete: () => void; onClose: () => void; showSecondary?: boolean;
}) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [retained, setRetained] = useState(review.images.map((image) => image.id));
  const [queue, setQueue] = useState<QueuedReviewImage[]>([]);
  const queueRef = useRef<QueuedReviewImage[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const images = review.images.filter((image) => retained.includes(image.id));
  const validFiles = queue.filter((item) => !item.error);
  const previewImages = [...images.map((image) => ({ id: image.id, url: image.url })), ...validFiles.map((item) => ({ id: item.objectUrl, url: item.objectUrl }))];
  const selectedImage = previewImages.find((image) => image.url === previewUrl) ?? previewImages[0];

  useEffect(() => () => { queueRef.current.forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.objectUrl); }); }, []);
  function replaceQueue(next: QueuedReviewImage[]) { queueRef.current = next; setQueue(next); }
  function addFiles(files: File[]) {
    if (pending) return;
    let count = images.length + validFiles.length;
    const added = files.map((file): QueuedReviewImage => {
      const errors = Object.values(validateReviewFiles([file]).errors).map((message) => message.replace("รูปแต่ละรูปต้องไม่เกิน 5 MB", "ขนาดต้องไม่เกิน 5 MB ต่อรูป"));
      const extension = file.name.split(".").at(-1)?.toLowerCase();
      if ((file.type === "image/jpeg" && extension !== "jpg" && extension !== "jpeg")
        || (file.type === "image/png" && extension !== "png") || (file.type === "image/webp" && extension !== "webp")) errors.push("ชนิดไฟล์ไม่ตรงกับนามสกุล");
      if (!errors.length && count >= MAX_REVIEW_IMAGES) errors.push("รวมได้สูงสุด 5 รูป กรุณานำรูปเดิมหรือรูปที่รอบันทึกออก");
      if (errors.length) return { file, objectUrl: "", error: errors.join(" · ") };
      count += 1;
      return { file, objectUrl: URL.createObjectURL(file) };
    });
    replaceQueue([...queueRef.current, ...added]);
  }
  function removeQueued(index: number) {
    const item = queueRef.current[index];
    if (item?.objectUrl) URL.revokeObjectURL(item.objectUrl);
    if (previewUrl === item?.objectUrl) setPreviewUrl(null);
    if (lightboxUrl === item?.objectUrl) setLightboxUrl(null);
    replaceQueue(queueRef.current.filter((_, position) => position !== index));
  }
  function submit() {
    if (pending || queue.some((item) => item.error)) return;
    const form = new FormData();
    form.set("rating", String(rating)); form.set("comment", comment); form.set("retainedImageIds", JSON.stringify(retained));
    validFiles.forEach((item) => form.append("images", item.file));
    onSave(form);
  }
  const galleryItems: GalleryItem[] = previewImages.filter((image) => image.url.startsWith("blob:") || safeReviewImageUrl(image.url)).map((image) => ({
    key: image.id, url: image.url, caption: null, imageName: null, isCover: false, isMock: false, zone: null, zoneKey: "guest-review", zoneLabel: "รูปรีวิว",
  }));
  const activeItem = galleryItems.find((item) => item.url === lightboxUrl);
  return <>
    <section aria-label="รายละเอียดรีวิว" className="min-w-0 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm sm:p-5">
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
          <legend className="sr-only">แก้ไขคะแนน ข้อความ และรูปรีวิว</legend>
          <div><p id="review-rating-label" className="text-base font-semibold">คะแนนรีวิว</p><div role="group" aria-labelledby="review-rating-label" className="mt-2 flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} ดาว`} aria-pressed={rating === value} onClick={() => setRating(value)} className={`rounded-lg border p-3 transition ${rating === value ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]" : "border-[var(--site-border)] hover:border-[var(--site-primary)]"}`}><Star aria-hidden="true" size={25} className={value <= rating ? "fill-amber-400 text-amber-500" : "text-[var(--site-muted)]"} /></button>)}
          </div><p className="mt-1 text-xs text-[var(--site-muted)]">{rating} จาก 5 ดาว</p>{fieldErrors.rating ? <p role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.rating}</p> : null}</div>
          <label className="grid gap-2 text-base font-semibold">ข้อความรีวิว
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={MAX_REVIEW_COMMENT_LENGTH} aria-invalid={Boolean(fieldErrors.comment)} aria-describedby={fieldErrors.comment ? "review-comment-error" : undefined}
              className="min-h-32 w-full min-w-0 rounded-lg border border-[var(--site-border)] bg-transparent p-3 text-sm font-normal leading-7 outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary-soft)]" />
            <span className="text-right text-xs font-normal text-[var(--site-muted)]">{comment.length.toLocaleString()} / {MAX_REVIEW_COMMENT_LENGTH.toLocaleString()} ตัวอักษร</span>
          </label>
          {fieldErrors.comment ? <p role="alert" id="review-comment-error" className="text-sm text-red-700">{fieldErrors.comment}</p> : null}
          <ReviewImageManager images={images} queue={queue} disabled={pending} fieldErrors={fieldErrors} onFiles={addFiles} onRemoveQueued={removeQueued}
            onRemoveRetained={(id) => { setRetained((current) => current.filter((value) => value !== id)); setPreviewUrl(null); setLightboxUrl(null); }} onPreview={setPreviewUrl} />
          {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 [overflow-wrap:anywhere]">{error}</div> : null}
          {Object.entries(fieldErrors).filter(([key]) => !["rating", "comment", "images", "retainedImageIds"].includes(key) && !key.startsWith("images.")).map(([key, value]) => <p role="alert" className="text-sm text-red-700" key={key}>{value}</p>)}
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--site-border)] pt-4">
            <button type="button" onClick={onDelete} className="mr-auto text-sm font-medium text-red-700 hover:underline">ลบรีวิวถาวร</button>
            <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-[var(--site-border)] px-5 py-2.5 text-sm font-semibold">ยกเลิก</button>
            <button type="submit" disabled={pending || queue.some((item) => item.error)} className="rounded-lg bg-[var(--site-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--site-on-primary)] disabled:opacity-50">{pending ? "กำลังดำเนินการ…" : "บันทึกการแก้ไข"}</button>
          </div>
        </fieldset>
      </form>
    </section>
    {showSecondary ? <aside className="min-w-0 space-y-4" aria-label="ภาพตัวอย่างและประวัติ">
      <section className="rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <h2 className="font-semibold">ภาพตัวอย่าง</h2>
        {selectedImage ? <button type="button" disabled={pending} aria-label="เปิดรูปขนาดเต็ม" onClick={() => setLightboxUrl(selectedImage.url)} className="mt-3 block w-full"><ReviewImagePreview key={selectedImage.url} url={selectedImage.url} alt="ภาพตัวอย่างรีวิวที่เลือก" large /></button> : <p className="py-8 text-center text-sm text-[var(--site-muted)]">ไม่มีรูปภาพ</p>}
        <p className="mt-3 text-xs text-[var(--site-muted)]">เลือกภาพจากตัวแก้ไข แล้วกดภาพตัวอย่างเพื่อขยาย</p>
      </section>
      <ReviewHistory createdAt={review.createdAt} rating={review.rating} comment={review.comment} images={review.images} logs={review.editLogs} />
    </aside> : null}
    {activeItem ? <GalleryLightbox activeItem={activeItem} categories={[{ key: "guest-review", label: "รูปรีวิว", items: galleryItems }]} listing={{ id: review.villaId }}
      getImageSrc={(item) => item.url.startsWith("blob:") ? item.url : safeReviewImageUrl(item.url)} onClose={() => setLightboxUrl(null)} onSelect={(item) => setLightboxUrl(item.url)} onImageError={() => undefined}
      showCategorySelector={false} showDownload={false} thumbnailPlacement="bottom" eyebrow="รูปรีวิว" title="รูปจากผู้เข้าพัก" /> : null}
  </>;
}
