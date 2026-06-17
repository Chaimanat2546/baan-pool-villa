"use client";

import type { GuideStatus } from "@/lib/guides/types";
import { createSlugFromTitle } from "@/lib/guides/validation";

import type { AdminGuideDraft } from "./admin-guide-types";

interface GuideListProps {
  activeDraftId: string | null;
  guides: AdminGuideDraft[];
  onSelect: (draftId: string) => void;
  getStatusLabel: (status: GuideStatus) => string;
}

export function GuideList({
  activeDraftId,
  guides,
  onSelect,
  getStatusLabel,
}: GuideListProps) {
  return (
    <aside className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      <div className="border-b border-[var(--site-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--site-text)]">
              รายการบทความ
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
              เลือกบทความเพื่อแก้ไขหรือดูสถานะการเผยแพร่
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--site-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-primary)]">
            {guides.length} รายการ
          </span>
        </div>
      </div>
      <div className="grid max-h-[680px] gap-2 overflow-y-auto p-3">
        {guides.map((guide) => {
          const isActive = guide.draftId === activeDraftId;

          return (
            <button
              className={`min-w-0 rounded-lg border px-3 py-3 text-left shadow-sm transition ${
                isActive
                  ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] ring-1 ring-[var(--site-primary)]/10"
                  : "border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-primary)]/35 hover:bg-[var(--site-surface-soft)]"
              }`}
              key={guide.draftId}
              onClick={() => {
                onSelect(guide.draftId);
              }}
              type="button"
            >
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 ${
                    guide.status === "published"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  }`}
                >
                  {getStatusLabel(guide.status)}
                </span>
                {guide.isPinned ? (
                  <span className="rounded-full bg-[var(--site-primary)] px-2.5 py-1 text-[10px] text-[var(--site-on-primary)]">
                    ปักหมุด
                  </span>
                ) : null}
              </span>
              <span className="mt-3 block line-clamp-2 text-sm font-semibold leading-6 text-[var(--site-text)]">
                {guide.title || "ยังไม่ได้ตั้งชื่อ"}
              </span>
              <span className="mt-2 block truncate text-xs text-[var(--site-muted)]">
                /guides/{createSlugFromTitle(guide.title)}
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--site-muted)]">
                <span className="truncate">
                  {guide.recommendedHouseIds.length} บ้านพักแนะนำ
                </span>
                <span className="shrink-0">{guide.tags.length} แท็ก</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
