import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LockKeyhole,
} from "lucide-react";
import type { DragEvent } from "react";

import type {
  FixedHomeSectionKey,
  HomePageLayoutItem,
} from "@/lib/home-sections/types";

import type { AdminSectionDraft } from "./types";

export const FIXED_SECTION_LABELS: Record<FixedHomeSectionKey, string> = {
  why_choose: "ทำไมต้องเลือกเรา",
  tiktok: "TikTok",
  customer_reviews: "รีวิวจากลูกค้า",
  articles: "บทความแนะนำ",
  faq: "คำถามที่พบบ่อย",
  contact: "ติดต่อเรา",
};

interface SectionListProps {
  activeLayoutIdentity: string | null;
  layout: HomePageLayoutItem[];
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: (identity: string) => void;
  onDrop: (identity: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSelect: (identity: string) => void;
  onToggle: (identity: string, enabled: boolean) => void;
  sections: AdminSectionDraft[];
}

export function SectionList({
  activeLayoutIdentity,
  layout,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  onSelect,
  onToggle,
  sections,
}: SectionListProps) {
  const sectionsBySlug = new Map(
    sections.map((section) => [section.slug, section]),
  );

  return (
    <aside className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-[var(--site-text)]">
            ลำดับส่วนบนหน้าแรก
          </h2>
          <p className="mt-0.5 text-xs text-[var(--site-muted)]">
            ลากหรือใช้ปุ่มลูกศรเพื่อเรียงส่วนใต้ Hero
          </p>
        </div>
        <span className="rounded bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-muted)]">
          {layout.length + 1} ส่วน
        </span>
      </div>

      <div className="space-y-2">
        <article
          className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3"
          data-home-hero-row
        >
          <LockKeyhole
            aria-hidden="true"
            className="size-4 text-[var(--site-muted)]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--site-text)]">
              Hero
            </p>
            <p className="text-xs font-semibold text-[var(--site-muted)]">
              อยู่บนสุดเสมอ
            </p>
          </div>
        </article>

        {layout.map((item, itemIndex) => {
          const identity = `${item.kind}:${item.key}`;
          const section =
            item.kind === "rail" ? sectionsBySlug.get(item.key) : null;
          const label =
            item.kind === "fixed"
              ? FIXED_SECTION_LABELS[item.key]
              : section?.title || "ยังไม่ได้ตั้งชื่อ";
          const isSelected = activeLayoutIdentity === identity;

          return (
            <article
              className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border px-3 py-3 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${
                isSelected
                  ? "border-[var(--site-primary)] bg-[var(--site-surface-soft)]"
                  : "border-[var(--site-border)] bg-[var(--site-surface)]"
              }`}
              data-layout-identity={identity}
              key={identity}
              onDragOver={onDragOver}
              onDrop={() => onDrop(identity)}
            >
              <button
                aria-label={`ลาก${label}`}
                className="inline-flex size-8 cursor-grab items-center justify-center rounded text-[var(--site-muted)] transition hover:bg-[var(--site-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] active:cursor-grabbing"
                draggable
                onDragEnd={onDragEnd}
                onDragStart={() => onDragStart(identity)}
                type="button"
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>

              <button
                aria-pressed={isSelected}
                className="min-w-0 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]"
                data-layout-select={item.kind}
                onClick={() => onSelect(identity)}
                type="button"
              >
                <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                  {itemIndex + 2}. {label}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded bg-[var(--site-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--site-primary)]">
                    {item.kind === "fixed" ? "ส่วนของระบบ" : "ชุดบ้านพัก"}
                  </span>
                  {section?.isNew ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      ใหม่
                    </span>
                  ) : null}
                </span>
              </button>

              <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                <label className="mr-auto inline-flex min-h-9 items-center gap-2 rounded px-2 text-xs font-semibold text-[var(--site-text)] sm:mr-1">
                  <input
                    aria-label={`แสดง${label}บนหน้าแรก`}
                    checked={item.enabled}
                    className="size-4 accent-[var(--site-primary)]"
                    onChange={(event) =>
                      onToggle(identity, event.target.checked)
                    }
                    type="checkbox"
                  />
                  แสดง
                </label>
                <button
                  aria-label={`เลื่อน${label}ขึ้น`}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={itemIndex === 0}
                  onClick={() => onMove(itemIndex, itemIndex - 1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  aria-label={`เลื่อน${label}ลง`}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={itemIndex === layout.length - 1}
                  onClick={() => onMove(itemIndex, itemIndex + 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
