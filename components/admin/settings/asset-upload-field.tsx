"use client";

import { ImageUp } from "lucide-react";
import Image from "next/image";

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
  return (
    <div className="rounded-md border border-[#dbe7e3] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <label
            className="text-sm font-semibold text-[#173f36]"
            htmlFor={id}
          >
            {label}
          </label>
          <p className="mt-1 text-xs leading-5 text-[#687d76]">{description}</p>
        </div>
        <label
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8]"
          htmlFor={id}
        >
          <ImageUp aria-hidden="true" className="size-4" />
          Choose file
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
        <figure className="overflow-hidden rounded-md border border-[#dbe7e3] bg-[#f8fbf9]">
          <div className="flex h-32 items-center justify-center overflow-hidden bg-white">
            {currentUrl ? (
              <Image
                alt={currentAlt}
                className="h-full w-full object-contain"
                height={128}
                sizes="(max-width: 768px) 100vw, 320px"
                src={currentUrl}
                width={320}
              />
            ) : (
              <span className="text-xs font-medium text-[#80958e]">
                No current image
              </span>
            )}
          </div>
          <figcaption className="border-t border-[#dbe7e3] px-3 py-2 text-xs font-medium text-[#506862]">
            {currentLabel}
          </figcaption>
        </figure>

        <figure className="overflow-hidden rounded-md border border-dashed border-[#b7cbc3] bg-[#f8fbf9]">
          <div className="flex h-32 items-center justify-center overflow-hidden bg-white">
            {selectedFile ? (
              <span className="max-w-full truncate px-3 text-xs font-semibold text-[#17463c]">
                {selectedFile.name}
              </span>
            ) : (
              <span className="text-xs font-medium text-[#80958e]">
                No new file selected
              </span>
            )}
          </div>
          <figcaption className="border-t border-[#dbe7e3] px-3 py-2 text-xs font-medium text-[#506862]">
            {selectedFile?.name ?? "Pending upload"}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
