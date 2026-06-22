"use client";

import { ImageUp } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { useEffect, useMemo, useState } from "react";

interface AssetUploadFieldProps {
  currentAlt: string;
  currentLabel: string;
  currentUrl: string;
  description: string;
  id: string;
  label: string;
  onFileChange: (file: File | null) => void;
  selectedFile: File | null;
  validateFile?: (file: File) => string[];
}

export function AssetUploadField({
  currentAlt,
  currentLabel,
  currentUrl,
  description,
  id,
  label,
  onFileChange,
  selectedFile,
  validateFile,
}: AssetUploadFieldProps) {
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const selectedPreviewUrl = useMemo(() => {
    return selectedFile ? URL.createObjectURL(selectedFile) : null;
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedPreviewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  return (
    <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <label
            className="text-sm font-semibold text-[var(--site-text)]"
            htmlFor={id}
          >
            {label}
          </label>
          <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">{description}</p>
        </div>
        <label
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
          htmlFor={id}
        >
          <ImageUp aria-hidden="true" className="size-4" />
          เลือกไฟล์
        </label>
      </div>

      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id={id}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;

          if (!file) {
            setFileErrors([]);
            onFileChange(null);
            return;
          }

          const validationErrors = validateFile?.(file) ?? [];

          if (validationErrors.length > 0) {
            setFileErrors(validationErrors);
            onFileChange(null);
            event.currentTarget.value = "";
            return;
          }

          setFileErrors([]);
          onFileChange(file);
        }}
        type="file"
      />

      {fileErrors.length > 0 ? (
        <div
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <ul className="grid gap-1">
            {fileErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <figure className="overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)]">
          <div className="relative flex h-32 items-center justify-center overflow-hidden bg-[var(--site-surface)]">
            {currentUrl ? (
              <Image
                alt={currentAlt}
                className="object-contain"
                fill
                sizes="(max-width: 768px) 100vw, 320px"
                src={currentUrl}
              />
            ) : (
              <span className="text-xs font-medium text-[var(--site-muted)]">
                ยังไม่มีรูปปัจจุบัน
              </span>
            )}
          </div>
          <figcaption className="border-t border-[var(--site-border)] px-3 py-2 text-xs font-medium text-[var(--site-muted)]">
            {currentLabel}
          </figcaption>
        </figure>

        <figure className="overflow-hidden rounded-md border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)]">
          <div className="relative flex h-32 items-center justify-center overflow-hidden bg-[var(--site-surface)]">
            {selectedFile ? (
              selectedPreviewUrl ? (
                <Image
                  alt={selectedFile.name}
                  className="object-contain"
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  src={selectedPreviewUrl}
                />
              ) : (
                <span className="max-w-full truncate px-3 text-xs font-semibold text-[var(--site-primary)]">
                  {selectedFile.name}
                </span>
              )
            ) : (
              <span className="text-xs font-medium text-[var(--site-muted)]">
                ยังไม่มีไฟล์ใหม่ที่เลือก
              </span>
            )}
          </div>
          <figcaption className="border-t border-[var(--site-border)] px-3 py-2 text-xs font-medium text-[var(--site-muted)]">
            {selectedFile?.name ?? "รออัปโหลด"}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
