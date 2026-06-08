"use client";

import { ImageUp } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo } from "react";

interface AssetUploadFieldProps {
  currentAlt: string;
  currentLabel: string;
  currentUrl: string;
  description: string;
  id: string;
  label: string;
  onFileChange: (file: File | null) => void;
  selectedFile: File | null;
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
}: AssetUploadFieldProps) {
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
          onFileChange(event.target.files?.[0] ?? null);
        }}
        type="file"
      />

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
                  unoptimized
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
