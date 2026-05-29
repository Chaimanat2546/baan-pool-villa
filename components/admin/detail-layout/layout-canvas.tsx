"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  X,
} from "lucide-react";
import type { DragEvent } from "react";

import type {
  DetailLayoutDraft,
  DetailLayoutDraftRow,
  DetailLayoutBlockType,
} from "./types";
import { isDetailLayoutBlockType } from "./detail-layout-helpers";

const LOCKED_ROWS = [
  {
    id: "locked-gallery",
    label: "แกลเลอรี",
    description: "ล็อกไว้ด้านบนสุดของหน้า Details",
  },
  {
    id: "locked-intro",
    label: "ข้อมูลเริ่มต้นบ้านพัก",
    description: "ชื่อบ้าน ราคา ข้อมูลสรุป และปุ่มติดต่อหลัก",
  },
] as const;

interface LayoutCanvasProps {
  activeBlockIndex: number | null;
  activeRowId: string | null;
  layout: DetailLayoutDraft;
  onDeleteRow: (rowId: string) => void;
  onDropBlock: (
    rowId: string,
    blockIndex: number,
    type: DetailLayoutBlockType,
  ) => void;
  onDuplicateRow: (rowId: string) => void;
  onMoveRow: (fromIndex: number, toIndex: number) => void;
  onRemoveBlock: (rowId: string, blockIndex: number) => void;
  onSelectBlock: (rowId: string, blockIndex: number) => void;
  onSelectRow: (rowId: string) => void;
  onToggleRowEnabled: (rowId: string, enabled: boolean) => void;
}

function getGridClass(row: DetailLayoutDraftRow): string {
  if (row.columns === 1) {
    return "grid-cols-1";
  }

  if (row.columns === 3) {
    return "grid-cols-1 md:grid-cols-3";
  }

  if (row.ratio === "70/30") {
    return "grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]";
  }

  if (row.ratio === "60/40") {
    return "grid-cols-1 md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]";
  }

  if (row.ratio === "40/60") {
    return "grid-cols-1 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]";
  }

  if (row.ratio === "30/70") {
    return "grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]";
  }

  return "grid-cols-1 md:grid-cols-2";
}

function getSlotIndexes(columns: DetailLayoutDraftRow["columns"]): number[] {
  return Array.from({ length: columns }, (_, index) => index);
}

export function getDetailLayoutDropType(
  dataTransfer: Pick<DataTransfer, "getData">,
): DetailLayoutBlockType | null {
  const value = dataTransfer.getData("text/plain");

  return isDetailLayoutBlockType(value) ? value : null;
}

export function LayoutCanvas({
  activeBlockIndex,
  activeRowId,
  layout,
  onDeleteRow,
  onDropBlock,
  onDuplicateRow,
  onMoveRow,
  onRemoveBlock,
  onSelectBlock,
  onSelectRow,
  onToggleRowEnabled,
}: LayoutCanvasProps) {
  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
    blockIndex: number,
  ) {
    event.preventDefault();
    const type = getDetailLayoutDropType(event.dataTransfer);

    if (type) {
      onDropBlock(rowId, blockIndex, type);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] shadow-sm">
      <div className="border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--site-text)]">
          โครงหน้า Details
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
          แถวด้านบนล็อกไว้ แก้ไขได้เฉพาะแถวด้านล่าง
        </p>
      </div>

      <div className="grid gap-3 p-3">
        <div className="grid gap-2">
          {LOCKED_ROWS.map((row) => (
            <div
              className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-3"
              key={row.id}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--site-text)]">
                    {row.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--site-muted)]">
                    {row.description}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-muted)]">
                  ล็อก
                </span>
              </div>
            </div>
          ))}
        </div>

        {layout.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-8 text-center text-sm text-[var(--site-muted)]">
            ยังไม่มีแถวด้านล่าง กดเพิ่มแถวเพื่อเริ่มจัดหน้า
          </div>
        ) : (
          <div className="grid gap-3">
            {layout.rows.map((row, rowIndex) => {
              const isActive = row.id === activeRowId;

              return (
                <article
                  className={`rounded-lg border bg-[var(--site-surface)] p-3 transition ${
                    isActive
                      ? "border-[var(--site-primary)] shadow-sm"
                      : "border-[var(--site-border)]"
                  } ${row.enabled ? "" : "opacity-60"}`}
                  key={row.id}
                >
                  <button
                    aria-pressed={isActive}
                    className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-2 text-left"
                    onClick={() => {
                      onSelectRow(row.id);
                    }}
                    type="button"
                  >
                    <GripVertical
                      aria-hidden="true"
                      className="mt-1 size-4 text-[var(--site-muted)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                        แถวที่ {rowIndex + 1}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--site-muted)]">
                        {row.columns} คอลัมน์
                        {row.ratio ? ` / ${row.ratio}` : ""} /{" "}
                        {row.blocks.length} block
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {row.enabled ? "เปิด" : "ปิด"}
                    </span>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      aria-label="เลื่อนแถวขึ้น"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={rowIndex <= 0}
                      onClick={() => {
                        onMoveRow(rowIndex, rowIndex - 1);
                      }}
                      title="เลื่อนขึ้น"
                      type="button"
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label="เลื่อนแถวลง"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={rowIndex >= layout.rows.length - 1}
                      onClick={() => {
                        onMoveRow(rowIndex, rowIndex + 1);
                      }}
                      title="เลื่อนลง"
                      type="button"
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={row.enabled ? "ปิดแถว" : "เปิดแถว"}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                      onClick={() => {
                        onToggleRowEnabled(row.id, !row.enabled);
                      }}
                      title={row.enabled ? "ปิดแถว" : "เปิดแถว"}
                      type="button"
                    >
                      {row.enabled ? (
                        <Eye aria-hidden="true" className="size-4" />
                      ) : (
                        <EyeOff aria-hidden="true" className="size-4" />
                      )}
                    </button>
                    <button
                      aria-label="คัดลอกแถว"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                      onClick={() => {
                        onDuplicateRow(row.id);
                      }}
                      title="คัดลอกแถว"
                      type="button"
                    >
                      <Copy aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label="ลบแถว"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
                      onClick={() => {
                        onDeleteRow(row.id);
                      }}
                      title="ลบแถว"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>

                  <div className={`mt-3 grid gap-2 ${getGridClass(row)}`}>
                    {getSlotIndexes(row.columns).map((blockIndex) => {
                      const block = row.blocks[blockIndex];
                      const isSelectedBlock =
                        isActive && activeBlockIndex === blockIndex;

                      return (
                        <div
                          className={`min-h-24 rounded-lg border ${
                            isSelectedBlock
                              ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                              : "border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                          } p-2`}
                          key={`${row.id}-${blockIndex}`}
                          onDragOver={handleDragOver}
                          onDrop={(event) => {
                            handleDrop(event, row.id, blockIndex);
                          }}
                        >
                          {block ? (
                            <div className="grid h-full min-h-20 w-full grid-cols-[1fr_auto] gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2">
                              <button
                                aria-pressed={isSelectedBlock}
                                className="min-w-0 text-left"
                                onClick={() => {
                                  onSelectBlock(row.id, blockIndex);
                                }}
                                type="button"
                              >
                                <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                                  {block.title}
                                </span>
                                <span className="mt-1 block truncate text-xs text-[var(--site-muted)]">
                                  {block.enabled ? "เปิด" : "ปิด"}
                                  {block.hideWhenEmpty
                                    ? " / ซ่อนเมื่อไม่มีข้อมูล"
                                    : ""}
                                </span>
                              </button>
                              <button
                                aria-label="ลบ block"
                                className="inline-flex size-7 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50"
                                onClick={() => {
                                  onRemoveBlock(row.id, blockIndex);
                                }}
                                title="ลบ block"
                                type="button"
                              >
                                <X aria-hidden="true" className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex h-full min-h-20 items-center justify-center rounded-md border border-dashed border-[var(--site-border)] px-3 py-4 text-center text-sm font-semibold text-[var(--site-muted)]">
                              ลาก block ลงช่องนี้
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
