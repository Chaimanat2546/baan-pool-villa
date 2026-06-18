"use client";

import {
  CheckCircle2,
  Eye,
  ExternalLink,
  FileText,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { GuideStatus } from "@/lib/guides/types";
import { createSlugFromTitle } from "@/lib/guides/validation";

import type { AdminGuideDraft } from "./admin-guide-types";
import {
  formatCommaSeparatedInput,
  parseCommaSeparatedTags,
  parseRecommendedHouseIdsInput,
} from "./guide-input-helpers";

interface GuideStatusPanelProps {
  guide: AdminGuideDraft;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isUploading: boolean;
  onCoverSelect: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
  onUpdate: (changes: Partial<AdminGuideDraft>) => void;
  pendingCoverFile: File | null;
  statusLabel: string;
}

export function GuideStatusPanel({
  guide,
  hasUnsavedChanges,
  isSaving,
  isUploading,
  onCoverSelect,
  onDelete,
  onSave,
  onUpdate,
  pendingCoverFile,
  statusLabel,
}: GuideStatusPanelProps) {
  const [tagsInputText, setTagsInputText] = useState(() =>
    formatCommaSeparatedInput(guide.tags),
  );
  const [houseIdsInputText, setHouseIdsInputText] = useState(() =>
    formatCommaSeparatedInput(guide.recommendedHouseIds),
  );
  const slugPreview = createSlugFromTitle(guide.title);
  const previewHref = `/guides/${slugPreview}`;
  const pendingCoverPreviewUrl = useMemo(() => {
    if (!pendingCoverFile || typeof URL.createObjectURL !== "function") {
      return null;
    }

    return URL.createObjectURL(pendingCoverFile);
  }, [pendingCoverFile]);
  const statusTone =
    guide.status === "published"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";
  const coverPreviewUrl = pendingCoverPreviewUrl ?? guide.coverImage?.url ?? null;
  const coverPreviewAlt = pendingCoverFile?.name ?? guide.coverImage?.alt ?? "";

  useEffect(() => {
    if (!pendingCoverPreviewUrl || typeof URL.revokeObjectURL !== "function") {
      return;
    }

    return () => {
      URL.revokeObjectURL(pendingCoverPreviewUrl);
    };
  }, [pendingCoverPreviewUrl]);

  return (
    <aside className="grid content-start gap-4">
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--site-text)]">
              สถานะบทความ
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
              จัดการการเผยแพร่ เส้นทางลิงก์ และตำแหน่งแสดงผลของบทความนี้
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 ring-1 ${statusTone}`}
            >
              {statusLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                hasUnsavedChanges
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              {hasUnsavedChanges
                ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก"
                : "บันทึกล่าสุดแล้ว"}
            </span>
          </div>

          <label className="block text-sm font-medium text-[var(--site-text)]">
            สถานะ
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
              onChange={(event) => {
                onUpdate({ status: event.target.value as GuideStatus });
              }}
              value={guide.status}
            >
              <option value="draft">ฉบับร่าง</option>
              <option value="published">เผยแพร่</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
            <input
              checked={guide.isPinned}
              className="size-4 accent-[var(--site-primary)]"
              onChange={(event) => {
                onUpdate({ isPinned: event.target.checked });
              }}
              type="checkbox"
            />
            ปักหมุดบทความ
          </label>

          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--site-muted)]">
              เส้นทางบทความ
            </p>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--site-text)]">
              /guides/{slugPreview}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              href={previewHref}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              พรีวิว
            </a>
            <button
              aria-label="ลบบทความ"
              className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
              onClick={() => {
                void onDelete();
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <p className="text-sm font-bold text-[var(--site-text)]">รูปปก</p>
        <div className="mt-3 overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)]">
          {coverPreviewUrl ? (
            <Image
              alt={coverPreviewAlt}
              className="aspect-[16/10] w-full object-cover"
              height={600}
              loading="eager"
              src={coverPreviewUrl}
              unoptimized
              width={960}
            />
          ) : (
            <div className="grid aspect-[16/10] place-items-center text-sm text-[var(--site-muted)]">
              ยังไม่มีรูปปก
            </div>
          )}
        </div>
        <label className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]">
          <Upload aria-hidden="true" className="size-4" />
          {isUploading ? "กำลังอัปโหลด" : "อัปโหลดรูปปก"}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            data-guide-cover-input="true"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void onCoverSelect(file);
              }

              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-[var(--site-text)]">
          คำอธิบายรูป
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              if (!guide.coverImage) {
                return;
              }

              onUpdate({
                coverImage: {
                  ...guide.coverImage,
                  alt: event.target.value,
                },
              });
            }}
            value={guide.coverImage?.alt ?? ""}
          />
        </label>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          แท็ก
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              setTagsInputText(event.target.value);
              onUpdate({ tags: parseCommaSeparatedTags(event.target.value) });
            }}
            placeholder="ครอบครัว,พูลวิลล่าพัทยา,บ้านพักแนะนำ"
            type="text"
            value={tagsInputText}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--site-muted)]">
          คั่นแต่ละแท็กด้วย comma
        </p>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          บ้านพักแนะนำ
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              setHouseIdsInputText(event.target.value);
              onUpdate({
                recommendedHouseIds: parseRecommendedHouseIdsInput(
                  event.target.value,
                ),
              });
            }}
            placeholder="66,102,901"
            type="text"
            value={houseIdsInputText}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--site-muted)]">
          ใส่รหัสบ้านพักคั่นด้วย comma เช่น 66,102,901
        </p>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            <Eye aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-base font-bold text-[var(--site-text)]">
            ตัวอย่างการ์ดบทความ
          </h2>
        </div>
        <div className="mt-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
          <p className="text-xs font-semibold text-[var(--site-primary)]">
            {guide.tags[0] ?? "บทความ"}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[var(--site-text)]">
            {guide.title || "ยังไม่ได้ตั้งชื่อบทความ"}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--site-muted)]">
            {guide.excerpt || "ยังไม่มีคำโปรย"}
          </p>
          <p className="mt-3 text-xs text-[var(--site-muted)]">
            บ้านพักแนะนำ {guide.recommendedHouseIds.length} หลัง
          </p>
        </div>
      </section>

      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] shadow-md shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
        data-guide-save="true"
        disabled={isSaving || isUploading || !hasUnsavedChanges}
        onClick={() => {
          void onSave();
        }}
        type="button"
      >
        <Save
          aria-hidden="true"
          className={`size-4 ${isSaving ? "animate-pulse" : ""}`}
        />
        {isSaving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </aside>
  );
}
