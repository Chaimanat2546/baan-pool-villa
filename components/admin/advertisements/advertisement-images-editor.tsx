"use client";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { CspSafeImage } from "@/components/ui/csp-safe-image";
import { ADVERTISEMENT_IMAGE_LIMIT } from "@/lib/advertisements/types";
import { validateAdvertisementUpload } from "@/lib/advertisements/validation";

export interface DraftImage {
  key: string;
  id?: string;
  url: string;
  file?: File;
}
export function AdvertisementImagesEditor({
  images,
  disabled,
  onChange,
  onError,
  onObjectUrl,
}: {
  images: DraftImage[];
  disabled: boolean;
  onChange: (images: DraftImage[]) => void;
  onError: (errors: string[]) => void;
  onObjectUrl: (url: string) => void;
}) {
  const move = (index: number, delta: number) => {
    const next = [...images];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <section className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold">
        รูปโฆษณา ({images.length}/{ADVERTISEMENT_IMAGE_LIMIT})
        <input
          aria-label="เพิ่มรูปโฆษณา"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="w-full min-w-0 rounded-lg border border-[var(--site-border)] p-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-[var(--site-primary-soft)] file:p-2"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            const errors = files.flatMap(validateAdvertisementUpload);
            if (images.length + files.length > ADVERTISEMENT_IMAGE_LIMIT)
              errors.push(`เลือกรูปได้สูงสุด ${ADVERTISEMENT_IMAGE_LIMIT} รูป`);
            if (errors.length) {
              onError([...new Set(errors)]);
              return;
            }
            onChange([
              ...images,
              ...files.map((file) => {
                const url = URL.createObjectURL(file);
                onObjectUrl(url);
                return { key: crypto.randomUUID(), file, url };
              }),
            ]);
          }}
        />
      </label>
      <p className="text-xs leading-5 text-[var(--site-muted)]">
        JPG, PNG หรือ WebP ไม่เกินรูปละ 6 MB รูปแรกเป็นภาพปก
        รูปจะอัปโหลดเมื่อกดบันทึก
      </p>
      {images.length === 0 && (
        <p className="rounded-lg border border-dashed border-[var(--site-border)] p-6 text-center text-sm text-[var(--site-muted)]">
          เพิ่มรูปอย่างน้อย 1 รูป
        </p>
      )}
      <ol className="grid gap-2">
        {images.map((image, index) => (
          <li
            className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--site-border)] p-2"
            key={image.key}
          >
            <CspSafeImage
              src={image.url}
              alt={`รูปโฆษณาที่ ${index + 1}`}
              width={72}
              height={56}
              className="h-14 w-18 shrink-0 rounded object-cover"
              unoptimized
            />
            <span className="min-w-0 flex-1 truncate text-xs">
              {index === 0 ? "ภาพปก" : `รูปที่ ${index + 1}`}
              {image.file ? " · ยังไม่อัปโหลด" : ""}
            </span>
            <div className="flex shrink-0 gap-1">
              <button
                aria-label={`เลื่อนรูป ${index + 1} ขึ้น`}
                type="button"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="rounded p-2 hover:bg-[var(--site-primary-soft)] disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                aria-label={`เลื่อนรูป ${index + 1} ลง`}
                type="button"
                disabled={disabled || index === images.length - 1}
                onClick={() => move(index, 1)}
                className="rounded p-2 hover:bg-[var(--site-primary-soft)] disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                aria-label={`ลบรูป ${index + 1}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                className="rounded p-2 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
