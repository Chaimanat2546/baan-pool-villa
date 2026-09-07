"use client";

import { Star, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import {
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_IMAGES,
  normalizeThaiPhone,
  validateReviewFiles,
} from "@/lib/villa-reviews/input-validation";
import type { PublicVillaReview } from "@/lib/villa-reviews/types";
import { useLockedBodyScroll } from "./use-locked-body-scroll";

type Preview = { file: File; url: string };
type RejectedFile = { name: string; message: string };
const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--site-border,#d9e2df)] bg-[var(--site-surface,#ffffff)] p-3 text-[var(--site-text,#17342f)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary,#0f766e)]";
const buttonClass =
  "rounded-full px-5 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary,#0f766e)] disabled:opacity-50";

export function VillaReviewModal({
  villaId,
  onClose,
  onSubmitted,
}: {
  villaId: string;
  onClose: () => void;
  onSubmitted: (review: PublicVillaReview) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const previewsRef = useRef<Preview[]>([]);
  const submittingRef = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [bookingCode, setBookingCode] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useLockedBodyScroll(true);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previewsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
      previewsRef.current = [];
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    focusTarget.current?.focus();
  }, [step]);

  function replacePreviews(next: Preview[]) {
    previewsRef.current = next;
    setPreviews(next);
  }

  function selectFiles(files: File[]) {
    const accepted: File[] = [];
    const rejected: RejectedFile[] = [];

    for (const file of files) {
      if (previews.length + accepted.length >= MAX_REVIEW_IMAGES) {
        // Keep the valid first five files and silently ignore any remainder.
        // A persisted per-file error here outlives the selection that caused it,
        // even though the actual form state already satisfies the five-image limit.
        continue;
      }

      const validation = validateReviewFiles([file]);
      const message = Object.values(validation.errors).join(" ");
      if (message) {
        rejected.push({ name: file.name, message });
        continue;
      }

      accepted.push(file);
    }

    setRejectedFiles(rejected);
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith("images")),
      ),
    );
    setMessage("");
    if (accepted.length) {
      replacePreviews([
        ...previews,
        ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setMessage("");
    setDetectedWords([]);
    if (step === 1) {
      const nextErrors: Record<string, string> = {};
      if (!bookingCode.trim()) nextErrors.bookingCode = "กรุณากรอกรหัสการจอง";
      if (!normalizeThaiPhone(phone))
        nextErrors.phone = "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) setStep(2);
      return;
    }
    const nextErrors = validateReviewFiles(
      previews.map(({ file }) => file),
    ).errors;
    if (rating < 1 || rating > 5)
      nextErrors.rating = "กรุณาเลือกคะแนนรีวิว 1 ถึง 5";
    if (comment.trim().length > MAX_REVIEW_COMMENT_LENGTH)
      nextErrors.comment = "ความคิดเห็นต้องไม่เกิน 1,000 ตัวอักษร";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const body = new FormData();
    body.set("bookingCode", bookingCode);
    body.set("phone", phone);
    body.set("rating", String(rating));
    body.set("comment", comment);
    previews.forEach(({ file }) => body.append("images", file));
    submittingRef.current = true;
    setPending(true);
    try {
      const response = await fetch(
        `/api/villas/${encodeURIComponent(villaId)}/reviews`,
        { method: "POST", body },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          typeof result.error === "string"
            ? result.error
            : "ส่งรีวิวไม่สำเร็จ กรุณาลองอีกครั้ง",
        );
        const fieldErrors: Record<string, string> = {};
        for (const key of [
          "bookingCode",
          "phone",
          "rating",
          "comment",
          "images",
          "images.0",
          "images.1",
          "images.2",
          "images.3",
          "images.4",
        ]) {
          if (typeof result.fieldErrors?.[key] === "string")
            fieldErrors[key] = result.fieldErrors[key];
        }
        setErrors(fieldErrors);
        setDetectedWords(
          Array.isArray(result.detectedWords)
            ? result.detectedWords
                .filter((word: unknown): word is string => typeof word === "string")
                .slice(0, 20)
            : [],
        );
        if (fieldErrors.bookingCode || fieldErrors.phone) setStep(1);
        return;
      }
      const review: PublicVillaReview = result.review;
      // Explicit public projection prevents accidental future private API fields reaching the parent.
      onSubmitted({
        id: review.id,
        villaId: review.villaId,
        rating: review.rating,
        comment: review.comment,
        maskedPhone: review.maskedPhone,
        images: review.images.map(({ id: imageId, url }) => ({
          id: imageId,
          url,
        })),
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      });
      previewsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
      replacePreviews([]);
      onClose();
    } catch {
      setMessage("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const error = (field: string) =>
    errors[field] ? (
      <p className="mt-2 text-sm text-red-700" id={`${id}-${field}-error`}>
        {errors[field]}
      </p>
    ) : null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-step`}
      className="fixed inset-0 z-[100] m-auto h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] max-w-xl overflow-hidden rounded-2xl border border-[var(--site-border,#d9e2df)] bg-[var(--site-surface,#ffffff)] p-0 text-[var(--site-text,#17342f)] shadow-[0_24px_80px_rgba(6,63,53,0.28)] backdrop:bg-black/55 sm:h-[min(42rem,calc(100dvh_-_3rem))] sm:w-[calc(100%_-_2rem)]"
      onCancel={(event) => {
        event.preventDefault();
        if (!submittingRef.current) onClose();
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-[var(--site-border,#d9e2df)] px-5 pb-5 pt-5 sm:px-7 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`${id}-title`} className="text-xl font-bold">
              เขียนรีวิวบ้านพัก
            </h2>
            <p
              id={`${id}-step`}
              className="mt-1 text-sm text-[var(--site-muted)]"
            >
              ขั้นตอน {step} จาก 2
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิดหน้าต่างรีวิว"
            disabled={pending}
            onClick={onClose}
            className="rounded-full p-2 focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]"
          >
            <X size={22} />
          </button>
        </div>
        <div className="mt-5 flex gap-2" aria-hidden="true">
          <span className="h-1 flex-1 rounded-full bg-[var(--site-primary,#0f766e)]" />
          <span
            className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-[var(--site-primary,#0f766e)]" : "bg-[var(--site-border,#d9e2df)]"}`}
          />
        </div>
        <h3
          ref={focusTarget}
          tabIndex={-1}
          className="mt-5 font-bold focus:outline-none"
        >
          {step === 1 ? "ข้อมูลการเข้าพัก" : "ประสบการณ์ของคุณ"}
        </h3>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div
            data-review-modal-scroll
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7"
          >
          {step === 1 ? (
            <>
              <p className="text-sm leading-6 text-[var(--site-muted)]">
                รหัสการจองและเบอร์โทรจะไม่แสดงสาธารณะ
                รีวิวจะแสดงเฉพาะเบอร์โทรที่ปิดบังแล้ว
              </p>
              <div>
                <label htmlFor={`${id}-booking`} className="text-sm font-bold">
                  รหัสการจอง
                </label>
                <input
                  id={`${id}-booking`}
                  name="bookingCode"
                  value={bookingCode}
                  onChange={(event) => setBookingCode(event.target.value)}
                  className={inputClass}
                  autoComplete="off"
                  required
                  aria-invalid={Boolean(errors.bookingCode)}
                  aria-describedby={
                    errors.bookingCode ? `${id}-bookingCode-error` : undefined
                  }
                />
                {error("bookingCode")}
              </div>
              <div>
                <label htmlFor={`${id}-phone`} className="text-sm font-bold">
                  เบอร์โทรศัพท์
                </label>
                <input
                  id={`${id}-phone`}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={inputClass}
                  placeholder="0812345678 หรือ +66812345678"
                  required
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={
                    errors.phone ? `${id}-phone-error` : undefined
                  }
                />
                {error("phone")}
              </div>
            </>
          ) : (
            <fieldset disabled={pending} className="space-y-5">
              <fieldset
                aria-describedby={
                  errors.rating ? `${id}-rating-error` : undefined
                }
              >
                <legend className="text-sm font-bold">คะแนนรีวิว</legend>
                <div
                  className="mt-2 flex gap-1"
                  role="radiogroup"
                  aria-label="คะแนนรีวิว"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label
                      key={value}
                      className="relative cursor-pointer rounded-lg p-2 has-focus-visible:outline-2 has-focus-visible:outline-[var(--site-primary)]"
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="rating"
                        aria-label={`${value} ดาว`}
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                      />
                      <Star
                        aria-hidden="true"
                        size={30}
                        className={
                          value <= rating
                            ? "fill-amber-400 text-amber-500"
                            : "text-[var(--site-muted)]"
                        }
                      />
                    </label>
                  ))}
                </div>
                {error("rating")}
              </fieldset>
              <div>
                <label htmlFor={`${id}-comment`} className="text-sm font-bold">
                  ความคิดเห็น (ไม่บังคับ)
                </label>
                <textarea
                  id={`${id}-comment`}
                  name="comment"
                  rows={4}
                  maxLength={MAX_REVIEW_COMMENT_LENGTH}
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setDetectedWords([]);
                  }}
                  className={`${inputClass} resize-y`}
                  placeholder="เล่าประสบการณ์การเข้าพักของคุณ"
                  aria-invalid={Boolean(errors.comment)}
                  aria-describedby={`${id}-comment-count${errors.comment ? ` ${id}-comment-error` : ""}`}
                />
                <p
                  id={`${id}-comment-count`}
                  className="mt-1 text-right text-xs text-[var(--site-muted)]"
                >
                  {comment.length}/1,000 ตัวอักษร
                </p>
                {error("comment")}
                {detectedWords.length ? (
                  <p className="mt-2 break-words text-sm text-red-700">
                    คำที่ตรวจพบ: {detectedWords.join(", ")}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${id}-images`} className="text-sm font-bold">
                  เพิ่มรูปภาพ (ไม่บังคับ)
                </label>
                <p
                  id={`${id}-image-help`}
                  className="mt-1 text-xs leading-5 text-[var(--site-muted)]"
                >
                  JPG, PNG หรือ WebP สูงสุด 5 รูป รูปละไม่เกิน 5 MB
                </p>
                <input
                  id={`${id}-images`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  multiple
                  className={`${inputClass} text-sm`}
                  aria-describedby={`${id}-image-help`}
                  onChange={(event) => {
                    selectFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                {rejectedFiles.map(({ name, message }) => (
                  <p
                    key={`${name}-${message}`}
                    className="mt-2 break-words text-sm text-red-700"
                  >
                    <span className="font-bold">{name}</span>: {message}
                  </p>
                ))}
                {error("images")}
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {previews.map(({ file, url }, index) => (
                    <div key={url} className="min-w-0">
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--site-surface-soft)]">
                        <Image
                          src={url}
                          alt={`รูปที่เลือกสำหรับรีวิว ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`ลบรูปที่ ${index + 1}`}
                          onClick={() => {
                            URL.revokeObjectURL(url);
                            replacePreviews(
                              previews.filter((preview) => preview.url !== url),
                            );
                            setErrors({});
                          }}
                          className="absolute right-1 top-1 rounded-full bg-[var(--site-surface)] p-1 text-[var(--site-text)]"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--site-muted)]">
                        {file.name}
                      </p>
                      {error(`images.${index}`)}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs leading-5 text-[var(--site-muted)]">
                เมื่อส่งแล้ว รีวิวและรูปภาพจะแสดงสาธารณะ
                กรุณาอย่าใส่ข้อมูลส่วนตัวในความคิดเห็นหรือรูปภาพ
              </p>
            </fieldset>
          )}
          <div
            aria-live="polite"
            role="status"
            className="break-words text-sm text-red-700"
          >
            {message ||
              (pending
                ? "กำลังส่งรีวิว…"
                : Object.keys(errors).length
                  ? "กรุณาตรวจสอบข้อมูลที่ระบุ"
                  : "")}
          </div>
          </div>
          <div
            data-review-modal-actions
            className="flex shrink-0 justify-end gap-2 border-t border-[var(--site-border,#d9e2df)] bg-[var(--site-surface,#ffffff)] px-5 py-4 sm:px-7"
          >
            {step === 2 ? (
              <button
                type="button"
                className={buttonClass}
                disabled={pending}
                onClick={() => {
                  setStep(1);
                  setErrors({});
                }}
              >
                ย้อนกลับ
              </button>
            ) : null}
            <button
              type="submit"
              className={`${buttonClass} bg-[var(--site-primary,#0f766e)] text-[var(--site-on-primary,#ffffff)]`}
              disabled={pending}
            >
              {step === 1 ? "ถัดไป" : pending ? "กำลังส่ง…" : "ส่งรีวิว"}
            </button>
          </div>
        </form>
      </div>
    </dialog>,
    document.body,
  );
}
