"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Columns2,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  PanelTop,
  Trash2,
  X,
} from "lucide-react";
import { useState, type DragEvent } from "react";

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
const ROW_DRAG_DATA_TYPE = "application/x-detail-layout-row-index";
const BLOCK_DRAG_DATA_TYPE = "application/x-detail-layout-block-location";

interface DetailLayoutBlockDragLocation {
  blockIndex: number;
  rowId: string;
}

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
  onMoveBlock: (
    fromRowId: string,
    fromBlockIndex: number,
    toRowId: string,
    toBlockIndex: number,
  ) => void;
  onAddRow: (columns: DetailLayoutDraftRow["columns"]) => void;
  onCompactRow: (rowId: string) => void;
  onRemoveBlock: (rowId: string, blockIndex: number) => void;
  onSelectBlock: (rowId: string, blockIndex: number) => void;
  onSelectRow: (rowId: string) => void;
  onToggleRowEnabled: (rowId: string, enabled: boolean) => void;
}

type AdminRowRole = "full-width-locked" | "split" | "standard" | "wide-flow";

interface AdminRowPresentation {
  badge: string | null;
  description: string | null;
  role: AdminRowRole;
}

function hasRecommendedVillasBlock(row: DetailLayoutDraftRow): boolean {
  return row.blocks.some((block) => block?.type === "recommended_villas");
}

function isSplitStarterRow(row: DetailLayoutDraftRow): boolean {
  return (
    row.columns === 2 &&
    (row.ratio === "70/30" || row.ratio === "30/70") &&
    !hasRecommendedVillasBlock(row)
  );
}

function getAdminRowPresentation(
  layout: DetailLayoutDraft,
  rowIndex: number,
): AdminRowPresentation {
  const row = layout.rows[rowIndex];

  if (hasRecommendedVillasBlock(row)) {
    return {
      badge: "ล็อกเต็มความกว้าง",
      description:
        "บ้านพักแนะนำจะแสดงเป็น section ยาวเต็มแถวเหมือน Gallery และข้อมูลบ้าน/ราคา",
      role: "full-width-locked",
    };
  }

  if (isSplitStarterRow(row)) {
    return {
      badge: `Split ${row.ratio}`,
      description:
        row.ratio === "70/30"
          ? "ฝั่ง 70 อยู่ซ้าย เป็น 2 คอลัมน์แบบ stack / ฝั่ง 30 อยู่ขวา เป็นแนวตั้ง"
          : "ฝั่ง 30 อยู่ซ้าย เป็นแนวตั้ง / ฝั่ง 70 อยู่ขวา เป็น 2 คอลัมน์แบบ stack",
      role: "split",
    };
  }

  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const previousRow = layout.rows[index];

    if (hasRecommendedVillasBlock(previousRow)) {
      return { badge: null, description: null, role: "standard" };
    }

    if (isSplitStarterRow(previousRow)) {
      return {
        badge: "อยู่ในฝั่ง 70",
        description: `แถวนี้จะไหลเข้า 2 คอลัมน์ของฝั่ง 70 ต่อจาก Split แถวที่ ${
          index + 1
        }`,
        role: "wide-flow",
      };
    }
  }

  return { badge: null, description: null, role: "standard" };
}

function getGridClass(row: DetailLayoutDraftRow): string {
  if (hasRecommendedVillasBlock(row)) {
    return "grid-cols-1";
  }

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

function hasGapBeforeBlock(row: DetailLayoutDraftRow): boolean {
  let hasEmptySlot = false;

  return row.blocks.some((block) => {
    if (block === null) {
      hasEmptySlot = true;
      return false;
    }

    return hasEmptySlot;
  });
}

export function getDetailLayoutDropType(
  dataTransfer: Pick<DataTransfer, "getData">,
): DetailLayoutBlockType | null {
  const value = dataTransfer.getData("text/plain");

  return isDetailLayoutBlockType(value) ? value : null;
}

export function getDetailLayoutRowDragIndex(
  dataTransfer: Pick<DataTransfer, "getData">,
  rowCount: number,
): number | null {
  const value = dataTransfer.getData(ROW_DRAG_DATA_TYPE);
  const index = Number(value);

  if (!Number.isInteger(index) || index < 0 || index >= rowCount) {
    return null;
  }

  return index;
}

export function getDetailLayoutBlockDragLocation(
  dataTransfer: Pick<DataTransfer, "getData">,
  layout: DetailLayoutDraft,
): DetailLayoutBlockDragLocation | null {
  const value = dataTransfer.getData(BLOCK_DRAG_DATA_TYPE);

  try {
    const payload = JSON.parse(value) as Partial<DetailLayoutBlockDragLocation>;
    const rowId = payload.rowId;
    const blockIndex = payload.blockIndex;

    if (
      typeof rowId !== "string" ||
      typeof blockIndex !== "number" ||
      !Number.isInteger(blockIndex)
    ) {
      return null;
    }

    const row = layout.rows.find((candidate) => candidate.id === rowId);

    if (!row || blockIndex < 0 || blockIndex >= row.blocks.length) {
      return null;
    }

    return { blockIndex, rowId };
  } catch {
    return null;
  }
}

function hasDetailLayoutRowDragType(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(ROW_DRAG_DATA_TYPE);
}

function hasDetailLayoutBlockDragType(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(BLOCK_DRAG_DATA_TYPE);
}

export function LayoutCanvas({
  activeBlockIndex,
  activeRowId,
  layout,
  onAddRow,
  onCompactRow,
  onDeleteRow,
  onDropBlock,
  onDuplicateRow,
  onMoveBlock,
  onMoveRow,
  onRemoveBlock,
  onSelectBlock,
  onSelectRow,
  onToggleRowEnabled,
}: LayoutCanvasProps) {
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [draggingBlockLocation, setDraggingBlockLocation] =
    useState<DetailLayoutBlockDragLocation | null>(null);
  const [dragOverBlockLocation, setDragOverBlockLocation] =
    useState<DetailLayoutBlockDragLocation | null>(null);

  function handleSlotDragOver(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
    blockIndex: number,
  ) {
    if (hasDetailLayoutRowDragType(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = hasDetailLayoutBlockDragType(
      event.dataTransfer,
    )
      ? "move"
      : "copy";
    setDragOverBlockLocation({ blockIndex, rowId });
  }

  function handleSlotDrop(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
    blockIndex: number,
  ) {
    if (hasDetailLayoutRowDragType(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverBlockLocation(null);

    const sourceBlockLocation = getDetailLayoutBlockDragLocation(
      event.dataTransfer,
      layout,
    );

    if (sourceBlockLocation) {
      onMoveBlock(
        sourceBlockLocation.rowId,
        sourceBlockLocation.blockIndex,
        rowId,
        blockIndex,
      );
      return;
    }

    const type = getDetailLayoutDropType(event.dataTransfer);

    if (type) {
      onDropBlock(rowId, blockIndex, type);
    }
  }

  function handleSlotDragLeave() {
    setDragOverBlockLocation(null);
  }

  function handleRowDragStart(
    event: DragEvent<HTMLButtonElement>,
    rowIndex: number,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ROW_DRAG_DATA_TYPE, String(rowIndex));
    setDraggingRowIndex(rowIndex);
    setDragOverRowIndex(rowIndex);
  }

  function handleRowDragOver(
    event: DragEvent<HTMLElement>,
    rowIndex: number,
  ) {
    if (!hasDetailLayoutRowDragType(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverRowIndex(rowIndex);
  }

  function handleRowDrop(event: DragEvent<HTMLElement>, toIndex: number) {
    if (!hasDetailLayoutRowDragType(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    const fromIndex = getDetailLayoutRowDragIndex(
      event.dataTransfer,
      layout.rows.length,
    );

    setDraggingRowIndex(null);
    setDragOverRowIndex(null);

    if (fromIndex === null || fromIndex === toIndex) {
      return;
    }

    onMoveRow(fromIndex, toIndex);
  }

  function handleRowDragEnd() {
    setDraggingRowIndex(null);
    setDragOverRowIndex(null);
  }

  function handleBlockDragStart(
    event: DragEvent<HTMLButtonElement>,
    rowId: string,
    blockIndex: number,
  ) {
    const location = { blockIndex, rowId };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(BLOCK_DRAG_DATA_TYPE, JSON.stringify(location));
    setDraggingBlockLocation(location);
    setDragOverBlockLocation(location);
  }

  function handleBlockDragEnd() {
    setDraggingBlockLocation(null);
    setDragOverBlockLocation(null);
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
              const rowHasGap = hasGapBeforeBlock(row);
              const rowPresentation = getAdminRowPresentation(layout, rowIndex);
              const isDraggingRow = draggingRowIndex === rowIndex;
              const isDragOverRow =
                dragOverRowIndex === rowIndex && draggingRowIndex !== rowIndex;

              return (
                <article
                  className={`rounded-lg border bg-[var(--site-surface)] p-3 transition ${
                    isDragOverRow
                      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] shadow-sm"
                      : isActive
                      ? "border-[var(--site-primary)] shadow-sm"
                      : "border-[var(--site-border)]"
                  } ${row.enabled ? "" : "opacity-60"} ${
                    isDraggingRow ? "opacity-70 ring-2 ring-[var(--site-primary)]/20" : ""
                  }`}
                  key={row.id}
                  onDragEnd={handleRowDragEnd}
                  onDragOver={(event) => {
                    handleRowDragOver(event, rowIndex);
                  }}
                  onDrop={(event) => {
                    handleRowDrop(event, rowIndex);
                  }}
                  data-detail-layout-admin-row-role={rowPresentation.role}
                >
                  <div
                    className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--site-primary)] bg-[var(--site-surface-soft)] shadow-sm"
                        : "border-[var(--site-border)] bg-[var(--site-surface)] hover:bg-[var(--site-surface-soft)]"
                    }`}
                  >
                    <button
                      aria-label={`ลากแถวที่ ${rowIndex + 1}`}
                      className="inline-flex size-8 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
                      draggable
                      onDragEnd={handleRowDragEnd}
                      onDragStart={(event) => {
                        handleRowDragStart(event, rowIndex);
                      }}
                      title={`ลากแถวที่ ${rowIndex + 1}`}
                      type="button"
                    >
                      <GripVertical aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-pressed={isActive}
                      className="min-w-0 text-left"
                      onClick={() => {
                        onSelectRow(row.id);
                      }}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--site-text)]">
                            แถวที่ {rowIndex + 1}
                          </span>
                          {isActive ? (
                            <span className="rounded-full bg-[var(--site-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--site-primary)]">
                              เลือกอยู่
                            </span>
                          ) : null}
                          {rowPresentation.badge ? (
                            <span className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--site-muted)]">
                              {rowPresentation.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--site-muted)]">
                          {row.columns} คอลัมน์
                          {row.ratio ? ` / ${row.ratio}` : ""} /{" "}
                          {row.blocks.length} block
                        </span>
                      </span>
                    </button>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {row.enabled ? "เปิด" : "ปิด"}
                    </span>
                  </div>

                  {rowPresentation.description ? (
                    <div className="mt-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--site-muted)]">
                      {rowPresentation.description}
                    </div>
                  ) : null}

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

                  {rowHasGap ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                        <CircleAlert
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        <span className="truncate">
                          มีช่องว่างก่อน block
                        </span>
                      </span>
                      <button
                        className="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                        onClick={() => {
                          onCompactRow(row.id);
                        }}
                        type="button"
                      >
                        จัด block ให้ชิดซ้าย
                      </button>
                    </div>
                  ) : null}

                  <div className={`mt-3 grid gap-2 ${getGridClass(row)}`}>
                    {getSlotIndexes(row.columns).map((blockIndex) => {
                      const block = row.blocks[blockIndex];
                      const isSelectedBlock =
                        isActive && activeBlockIndex === blockIndex;
                      const isDragOverBlockSlot =
                        dragOverBlockLocation?.rowId === row.id &&
                        dragOverBlockLocation.blockIndex === blockIndex &&
                        (draggingBlockLocation?.rowId !== row.id ||
                          draggingBlockLocation.blockIndex !== blockIndex);
                      const isDraggingBlock =
                        draggingBlockLocation?.rowId === row.id &&
                        draggingBlockLocation.blockIndex === blockIndex;

                      return (
                        <div
                          className={`min-h-24 rounded-lg border ${
                            isDragOverBlockSlot
                              ? "border-[var(--site-primary)] bg-[var(--site-surface)] ring-2 ring-[var(--site-primary)]/15"
                              : isSelectedBlock
                              ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                              : "border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                          } p-2`}
                          key={`${row.id}-${blockIndex}`}
                          onDragLeave={handleSlotDragLeave}
                          onDragOver={(event) => {
                            handleSlotDragOver(event, row.id, blockIndex);
                          }}
                          onDrop={(event) => {
                            handleSlotDrop(event, row.id, blockIndex);
                          }}
                        >
                          {block ? (
                            <div
                              className={`grid h-full min-h-20 w-full grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2 transition ${
                                isDraggingBlock ? "opacity-70" : ""
                              }`}
                            >
                              <button
                                aria-label={`ลาก block ${block.title}`}
                                className="inline-flex size-7 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
                                draggable
                                onDragEnd={handleBlockDragEnd}
                                onDragStart={(event) => {
                                  handleBlockDragStart(
                                    event,
                                    row.id,
                                    blockIndex,
                                  );
                                }}
                                title={`ลาก block ${block.title}`}
                                type="button"
                              >
                                <GripVertical
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </button>
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
                            <button
                              aria-pressed={isSelectedBlock}
                              className={`flex h-full min-h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center text-sm font-semibold transition ${
                                isSelectedBlock
                                  ? "border-[var(--site-primary)] bg-[var(--site-surface)] text-[var(--site-primary)]"
                                  : "border-[var(--site-border)] text-[var(--site-muted)] hover:border-[var(--site-primary)] hover:bg-[var(--site-surface)]"
                              }`}
                              onClick={() => {
                                onSelectBlock(row.id, blockIndex);
                              }}
                              type="button"
                            >
                              <span>
                                {isSelectedBlock
                                  ? "ช่องนี้กำลังเลือก"
                                  : "ลาก block ลงช่องนี้"}
                              </span>
                              {isSelectedBlock ? (
                                <span className="text-xs font-medium text-[var(--site-muted)]">
                                  กด block จากคลังเพื่อใส่ช่องนี้
                                </span>
                              ) : null}
                            </button>
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

        <div className="rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--site-text)]">
                เพิ่มแถวใหม่
              </p>
              <p className="mt-0.5 text-xs text-[var(--site-muted)]">
                เลือกจำนวนคอลัมน์แล้วลากหรือกด block ลงช่องที่ต้องการ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={() => {
                  onAddRow(1);
                }}
                type="button"
              >
                <PanelTop aria-hidden="true" className="size-4" />
                1 คอลัมน์
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={() => {
                  onAddRow(2);
                }}
                type="button"
              >
                <Columns2 aria-hidden="true" className="size-4" />
                2 คอลัมน์
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={() => {
                  onAddRow(3);
                }}
                type="button"
              >
                <Columns3 aria-hidden="true" className="size-4" />
                3 คอลัมน์
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
