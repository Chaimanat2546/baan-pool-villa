import { GripVertical } from "lucide-react";
import type { DragEvent } from "react";

import type { AdminSectionDraft } from "./types";
import { MODE_LABELS } from "./section-helpers";

interface SectionListProps {
  activeDraftId: string | null;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragStart: (draftId: string) => void;
  onDrop: (draftId: string) => void;
  onSelect: (draftId: string) => void;
  sections: AdminSectionDraft[];
}

export function SectionList({
  activeDraftId,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onSelect,
  sections,
}: SectionListProps) {
  return (
    <aside className="rounded-[22px] border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-[var(--site-text)]">
            ลำดับชุดบ้านพัก
          </h2>
          <p className="mt-0.5 text-xs text-[var(--site-muted)]">
            ลากเพื่อเรียงลำดับ หรือใช้ปุ่มลูกศรในชุดที่เลือก
          </p>
        </div>
        <span className="rounded-full bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-muted)]">
          {sections.length} ชุด
        </span>
      </div>
      {sections.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-5 text-sm text-[var(--site-muted)]">
          ยังไม่มีชุดบ้านพัก กดเพิ่มชุดบ้านพักเพื่อเริ่มจัดหน้าแรก
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, sectionIndex) => {
            const isActive = activeDraftId === section.draftId;
            const manualCount = section.items.length;

            return (
              <button
                aria-pressed={isActive}
                className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                  isActive
                    ? "border-[var(--site-primary)] bg-[var(--site-surface-soft)] shadow-sm"
                    : "border-[var(--site-border)] bg-[var(--site-surface)] hover:bg-[var(--site-surface-soft)]"
                }`}
                draggable
                key={section.draftId}
                onClick={() => {
                  onSelect(section.draftId);
                }}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDragStart={() => {
                  onDragStart(section.draftId);
                }}
                onDrop={() => {
                  onDrop(section.draftId);
                }}
                type="button"
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-4 text-[var(--site-muted)]"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--site-text)]">
                    {sectionIndex + 1}.{" "}
                    {section.title || "ยังไม่ได้ตั้งชื่อ"}
                  </span>
                  <span className="block truncate text-xs text-[var(--site-muted)]">
                    {MODE_LABELS.get(section.mode) ?? section.mode}
                    {section.mode === "manual" ? ` / ${manualCount} หลัง` : ""}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    section.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {section.isActive ? "เปิด" : "ปิด"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
