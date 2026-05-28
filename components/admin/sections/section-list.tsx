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
    <aside className="rounded-[22px] border border-[#dbe7e3] bg-white p-3 shadow-[0_12px_34px_rgba(6,63,53,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-[#063f35]">
            ลำดับชุดบ้านพัก
          </h2>
          <p className="mt-0.5 text-xs text-[#687d76]">
            ลากเพื่อเรียงลำดับ หรือใช้ปุ่มลูกศรในชุดที่เลือก
          </p>
        </div>
        <span className="rounded-full bg-[#f4f8f5] px-2.5 py-1 text-xs font-semibold text-[#55746b]">
          {sections.length} ชุด
        </span>
      </div>
      {sections.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[#c9d9d3] bg-[#f8fbf7] px-4 py-5 text-sm text-[#506862]">
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
                    ? "border-[#064e3b] bg-[#f8fbf7] shadow-[0_10px_24px_rgba(6,63,53,0.08)]"
                    : "border-[#dbe7e3] bg-white hover:bg-[#f8fbf7]"
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
                  className="size-4 text-[#668178]"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#123f36]">
                    {sectionIndex + 1}.{" "}
                    {section.title || "ยังไม่ได้ตั้งชื่อ"}
                  </span>
                  <span className="block truncate text-xs text-[#58726a]">
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
