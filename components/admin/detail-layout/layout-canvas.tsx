"use client";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  PanelTop,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

import { DETAIL_LAYOUT_OUTER_SPLIT_RATIOS } from "@/lib/detail-layout/defaults";

import { isDetailLayoutBlockType } from "./detail-layout-helpers";
import type {
  DetailLayoutBlockType,
  DetailLayoutDraft,
  DetailLayoutOuterRatio,
  DetailLayoutV2Draft,
  DetailLayoutV2DraftWideRow,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
} from "./types";

const ROW_DRAG_DATA_TYPE = "application/x-detail-layout-row-index";
const BLOCK_DRAG_DATA_TYPE = "application/x-detail-layout-block-location";
const WIDE_ROW_DRAG_DATA_TYPE = "application/x-detail-layout-v2-wide-row-index";
const NARROW_ROW_DRAG_DATA_TYPE =
  "application/x-detail-layout-v2-narrow-row-index";
const WIDE_BLOCK_DRAG_DATA_TYPE =
  "application/x-detail-layout-v2-wide-block-location";

const WIDE_ROW_OPTIONS: Array<{
  columns: DetailLayoutWideColumns;
  label: string;
  ratio?: DetailLayoutWideRatio;
}> = [
  { columns: 1, label: "1 คอลัมน์" },
  { columns: 2, label: "50/50", ratio: "50/50" },
];

interface DetailLayoutBlockDragLocation {
  blockIndex: number;
  rowId: string;
}

interface DetailLayoutWideBlockDragLocation {
  blockIndex: number;
  rowId: string;
}

export type DetailLayoutCanvasSelection =
  | {
      blockIndex: number;
      rowId: string;
      zone: "wide";
    }
  | {
      rowId: string;
      zone: "narrow";
    }
  | {
      blockIndex: number;
      zone: "lockedBottom";
    }
  | null;

export interface LayoutCanvasProps {
  activeSelection: DetailLayoutCanvasSelection;
  layout: DetailLayoutV2Draft;
  onAddNarrowRow: () => void;
  onAddWideRow: (
    columns: DetailLayoutWideColumns,
    ratio?: DetailLayoutWideRatio,
  ) => void;
  onDropNarrowBlock: (rowId: string, type: DetailLayoutBlockType) => void;
  onDropWideBlock: (
    rowId: string,
    blockIndex: number,
    type: DetailLayoutBlockType,
  ) => void;
  onMoveNarrowRow: (fromIndex: number, toIndex: number) => void;
  onMoveWideBlock: (
    fromRowId: string,
    fromBlockIndex: number,
    toRowId: string,
    toBlockIndex: number,
  ) => void;
  onMoveWideRow: (fromIndex: number, toIndex: number) => void;
  onOuterRatioChange: (ratio: DetailLayoutOuterRatio) => void;
  onRemoveNarrowBlock: (rowId: string) => void;
  onRemoveNarrowRow: (rowId: string) => void;
  onRemoveWideBlock: (rowId: string, blockIndex: number) => void;
  onRemoveWideRow: (rowId: string) => void;
  onSelectLockedBottomBlock: (blockIndex: number) => void;
  onSelectNarrowRow: (rowId: string) => void;
  onSelectWideBlock: (rowId: string, blockIndex: number) => void;
  onToggleNarrowRow: (rowId: string, enabled: boolean) => void;
  onToggleWideRow: (rowId: string, enabled: boolean) => void;
  onUpdateWideRow: (
    rowId: string,
    columns: DetailLayoutWideColumns,
    ratio?: DetailLayoutWideRatio,
  ) => void;
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

function getV2RowDragIndex(
  dataTransfer: Pick<DataTransfer, "getData">,
  dataType: string,
  rowCount: number,
): number | null {
  const value = dataTransfer.getData(dataType);
  const index = Number(value);

  if (!Number.isInteger(index) || index < 0 || index >= rowCount) {
    return null;
  }

  return index;
}

function getWideBlockDragLocation(
  dataTransfer: Pick<DataTransfer, "getData">,
  layout: DetailLayoutV2Draft,
): DetailLayoutWideBlockDragLocation | null {
  const value = dataTransfer.getData(WIDE_BLOCK_DRAG_DATA_TYPE);

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<DetailLayoutWideBlockDragLocation>;
    const rowId = payload.rowId;
    const blockIndex = payload.blockIndex;

    if (
      typeof rowId !== "string" ||
      typeof blockIndex !== "number" ||
      !Number.isInteger(blockIndex)
    ) {
      return null;
    }

    const row = layout.mainSplit.wideRows.find(
      (candidate) => candidate.id === rowId,
    );

    if (!row || blockIndex < 0 || blockIndex >= row.blocks.length) {
      return null;
    }

    return { blockIndex, rowId };
  } catch {
    return null;
  }
}

function hasDragType(dataTransfer: DataTransfer, type: string): boolean {
  return Array.from(dataTransfer.types).includes(type);
}

function getWideGridClass(row: DetailLayoutV2DraftWideRow): string {
  if (row.columns === 1) {
    return "grid-cols-1";
  }

  if (row.ratio === "60/40") {
    return "grid-cols-1 md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]";
  }

  if (row.ratio === "40/60") {
    return "grid-cols-1 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]";
  }

  return "grid-cols-1 md:grid-cols-2";
}

function getSlotIndexes(columns: DetailLayoutWideColumns): number[] {
  return Array.from({ length: columns }, (_, index) => index);
}

function isWideOptionActive(
  row: DetailLayoutV2DraftWideRow,
  option: (typeof WIDE_ROW_OPTIONS)[number],
): boolean {
  if (option.columns === 1) {
    return row.columns === 1;
  }

  return row.columns === 2 && row.ratio === option.ratio;
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        enabled
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-700"
      }`}
    >
      {enabled ? "เปิด" : "ปิด"}
    </span>
  );
}

function LockedShell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--site-muted)]">
          {label}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--site-muted)]">
          <Lock aria-hidden="true" className="size-3" />
          ล็อก
        </span>
      </div>
      {children}
    </div>
  );
}

export function LayoutCanvas({
  activeSelection,
  layout,
  onAddNarrowRow,
  onAddWideRow,
  onDropNarrowBlock,
  onDropWideBlock,
  onMoveNarrowRow,
  onMoveWideBlock,
  onMoveWideRow,
  onOuterRatioChange,
  onRemoveNarrowBlock,
  onRemoveNarrowRow,
  onRemoveWideBlock,
  onRemoveWideRow,
  onSelectLockedBottomBlock,
  onSelectNarrowRow,
  onSelectWideBlock,
  onToggleNarrowRow,
  onToggleWideRow,
  onUpdateWideRow,
}: LayoutCanvasProps) {
  const [draggingWideRowIndex, setDraggingWideRowIndex] = useState<
    number | null
  >(null);
  const [dragOverWideRowIndex, setDragOverWideRowIndex] = useState<
    number | null
  >(null);
  const [draggingNarrowRowIndex, setDraggingNarrowRowIndex] = useState<
    number | null
  >(null);
  const [dragOverNarrowRowIndex, setDragOverNarrowRowIndex] = useState<
    number | null
  >(null);
  const [draggingWideBlock, setDraggingWideBlock] =
    useState<DetailLayoutWideBlockDragLocation | null>(null);
  const [dragOverWideBlock, setDragOverWideBlock] =
    useState<DetailLayoutWideBlockDragLocation | null>(null);
  const [dragOverNarrowRowId, setDragOverNarrowRowId] = useState<string | null>(
    null,
  );

  const isWideLeft = layout.mainSplit.ratio === "70/30";
  const wideZone = renderWideZone();
  const narrowZone = renderNarrowZone();

  function handleWideSlotDragOver(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
    blockIndex: number,
  ) {
    if (
      hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = hasDragType(
      event.dataTransfer,
      WIDE_BLOCK_DRAG_DATA_TYPE,
    )
      ? "move"
      : "copy";
    setDragOverWideBlock({ blockIndex, rowId });
  }

  function handleWideSlotDrop(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
    blockIndex: number,
  ) {
    if (
      hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverWideBlock(null);

    const sourceBlock = getWideBlockDragLocation(event.dataTransfer, layout);

    if (sourceBlock) {
      onMoveWideBlock(
        sourceBlock.rowId,
        sourceBlock.blockIndex,
        rowId,
        blockIndex,
      );
      return;
    }

    const type = getDetailLayoutDropType(event.dataTransfer);

    if (type) {
      onDropWideBlock(rowId, blockIndex, type);
    }
  }

  function handleNarrowSlotDragOver(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
  ) {
    if (
      hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, WIDE_BLOCK_DRAG_DATA_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDragOverNarrowRowId(rowId);
  }

  function handleNarrowSlotDrop(
    event: DragEvent<HTMLDivElement>,
    rowId: string,
  ) {
    if (
      hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE) ||
      hasDragType(event.dataTransfer, WIDE_BLOCK_DRAG_DATA_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverNarrowRowId(null);

    const type = getDetailLayoutDropType(event.dataTransfer);

    if (type) {
      onDropNarrowBlock(rowId, type);
    }
  }

  function handleWideRowDragStart(
    event: DragEvent<HTMLButtonElement>,
    rowIndex: number,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(WIDE_ROW_DRAG_DATA_TYPE, String(rowIndex));
    setDraggingWideRowIndex(rowIndex);
    setDragOverWideRowIndex(rowIndex);
  }

  function handleWideRowDragOver(
    event: DragEvent<HTMLElement>,
    rowIndex: number,
  ) {
    if (!hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWideRowIndex(rowIndex);
  }

  function handleWideRowDrop(event: DragEvent<HTMLElement>, toIndex: number) {
    if (!hasDragType(event.dataTransfer, WIDE_ROW_DRAG_DATA_TYPE)) {
      return;
    }

    event.preventDefault();
    const fromIndex = getV2RowDragIndex(
      event.dataTransfer,
      WIDE_ROW_DRAG_DATA_TYPE,
      layout.mainSplit.wideRows.length,
    );

    setDraggingWideRowIndex(null);
    setDragOverWideRowIndex(null);

    if (fromIndex !== null && fromIndex !== toIndex) {
      onMoveWideRow(fromIndex, toIndex);
    }
  }

  function handleNarrowRowDragStart(
    event: DragEvent<HTMLButtonElement>,
    rowIndex: number,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(NARROW_ROW_DRAG_DATA_TYPE, String(rowIndex));
    setDraggingNarrowRowIndex(rowIndex);
    setDragOverNarrowRowIndex(rowIndex);
  }

  function handleNarrowRowDragOver(
    event: DragEvent<HTMLElement>,
    rowIndex: number,
  ) {
    if (!hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverNarrowRowIndex(rowIndex);
  }

  function handleNarrowRowDrop(event: DragEvent<HTMLElement>, toIndex: number) {
    if (!hasDragType(event.dataTransfer, NARROW_ROW_DRAG_DATA_TYPE)) {
      return;
    }

    event.preventDefault();
    const fromIndex = getV2RowDragIndex(
      event.dataTransfer,
      NARROW_ROW_DRAG_DATA_TYPE,
      layout.mainSplit.narrowRows.length,
    );

    setDraggingNarrowRowIndex(null);
    setDragOverNarrowRowIndex(null);

    if (fromIndex !== null && fromIndex !== toIndex) {
      onMoveNarrowRow(fromIndex, toIndex);
    }
  }

  function handleRowDragEnd() {
    setDraggingWideRowIndex(null);
    setDragOverWideRowIndex(null);
    setDraggingNarrowRowIndex(null);
    setDragOverNarrowRowIndex(null);
  }

  function handleWideBlockDragStart(
    event: DragEvent<HTMLButtonElement>,
    rowId: string,
    blockIndex: number,
  ) {
    const location = { blockIndex, rowId };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      WIDE_BLOCK_DRAG_DATA_TYPE,
      JSON.stringify(location),
    );
    setDraggingWideBlock(location);
    setDragOverWideBlock(location);
  }

  function handleWideBlockDragEnd() {
    setDraggingWideBlock(null);
    setDragOverWideBlock(null);
  }

  function renderWideZone() {
    return (
      <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--site-text)]">
              ฝั่ง 70
            </h3>
            <p className="mt-0.5 text-xs text-[var(--site-muted)]">
              แถวกว้างเลือกได้ 1 ช่องหรือ 50/50
            </p>
          </div>
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            onClick={() => {
              onAddWideRow(2, "50/50");
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            แถว 70 / 50-50
          </button>
        </div>

        {layout.mainSplit.wideRows.length === 0 ? (
          <button
            className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-6 text-center text-sm font-semibold text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface)]"
            onClick={() => {
              onAddWideRow(2, "50/50");
            }}
            type="button"
          >
            ยังไม่มีแถวในฝั่ง 70
            <span className="mt-1 text-xs font-medium">
              เพิ่มแถวแล้วลาก block ลงช่องที่ต้องการ
            </span>
          </button>
        ) : (
          <div className="grid gap-3">
            {layout.mainSplit.wideRows.map((row, rowIndex) =>
              renderWideRow(row, rowIndex),
            )}
          </div>
        )}
      </section>
    );
  }

  function renderWideRow(
    row: DetailLayoutV2DraftWideRow,
    rowIndex: number,
  ) {
    const isDraggingRow = draggingWideRowIndex === rowIndex;
    const isDragOverRow =
      dragOverWideRowIndex === rowIndex && draggingWideRowIndex !== rowIndex;

    return (
      <article
        className={`rounded-lg border bg-[var(--site-surface-soft)] p-2 transition ${
          isDragOverRow
            ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
            : "border-[var(--site-border)]"
        } ${row.enabled ? "" : "opacity-60"} ${
          isDraggingRow ? "opacity-70" : ""
        }`}
        key={row.id}
        onDragEnd={handleRowDragEnd}
        onDragOver={(event) => {
          handleWideRowDragOver(event, rowIndex);
        }}
        onDrop={(event) => {
          handleWideRowDrop(event, rowIndex);
        }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            aria-label={`ลากแถวฝั่ง 70 ลำดับที่ ${rowIndex + 1}`}
            className="inline-flex size-8 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
            draggable
            onDragEnd={handleRowDragEnd}
            onDragStart={(event) => {
              handleWideRowDragStart(event, rowIndex);
            }}
            title={`ลากแถวฝั่ง 70 ลำดับที่ ${rowIndex + 1}`}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--site-text)]">
                แถว 70 ที่ {rowIndex + 1}
              </p>
              <StatusPill enabled={row.enabled} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {WIDE_ROW_OPTIONS.map((option) => {
                const isActive = isWideOptionActive(row, option);

                return (
                  <button
                    className={`h-7 rounded-md border px-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
                        : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] hover:border-[var(--site-primary)]"
                    }`}
                    key={`${option.columns}-${option.ratio ?? "single"}`}
                    onClick={() => {
                      onUpdateWideRow(row.id, option.columns, option.ratio);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              aria-label="เลื่อนแถว 70 ขึ้น"
              className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rowIndex <= 0}
              onClick={() => {
                onMoveWideRow(rowIndex, rowIndex - 1);
              }}
              title="เลื่อนขึ้น"
              type="button"
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label="เลื่อนแถว 70 ลง"
              className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rowIndex >= layout.mainSplit.wideRows.length - 1}
              onClick={() => {
                onMoveWideRow(rowIndex, rowIndex + 1);
              }}
              title="เลื่อนลง"
              type="button"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label={row.enabled ? "ปิดแถว 70" : "เปิดแถว 70"}
              className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              onClick={() => {
                onToggleWideRow(row.id, !row.enabled);
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
              aria-label="ลบแถว 70"
              className="inline-flex size-8 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
              onClick={() => {
                onRemoveWideRow(row.id);
              }}
              title="ลบแถว"
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <div className={`mt-2 grid gap-2 ${getWideGridClass(row)}`}>
          {getSlotIndexes(row.columns).map((blockIndex) =>
            renderWideSlot(row, blockIndex),
          )}
        </div>
      </article>
    );
  }

  function renderWideSlot(
    row: DetailLayoutV2DraftWideRow,
    blockIndex: number,
  ) {
    const block = row.blocks[blockIndex];
    const isSelected =
      activeSelection?.zone === "wide" &&
      activeSelection.rowId === row.id &&
      activeSelection.blockIndex === blockIndex;
    const isDragOver =
      dragOverWideBlock?.rowId === row.id &&
      dragOverWideBlock.blockIndex === blockIndex &&
      (draggingWideBlock?.rowId !== row.id ||
        draggingWideBlock.blockIndex !== blockIndex);
    const isDragging =
      draggingWideBlock?.rowId === row.id &&
      draggingWideBlock.blockIndex === blockIndex;

    return (
      <div
        className={`min-h-24 rounded-lg border p-2 transition ${
          isDragOver
            ? "border-[var(--site-primary)] bg-[var(--site-surface)] ring-2 ring-[var(--site-primary)]/15"
            : isSelected
            ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
            : "border-dashed border-[var(--site-border)] bg-[var(--site-surface)]"
        }`}
        key={`${row.id}-${blockIndex}`}
        onDragLeave={() => {
          setDragOverWideBlock(null);
        }}
        onDragOver={(event) => {
          handleWideSlotDragOver(event, row.id, blockIndex);
        }}
        onDrop={(event) => {
          handleWideSlotDrop(event, row.id, blockIndex);
        }}
      >
        {block ? (
          <div
            className={`grid h-full min-h-20 grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2 transition ${
              isDragging ? "opacity-70" : ""
            }`}
          >
            <button
              aria-label={`ลาก block ${block.title}`}
              className="inline-flex size-7 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
              draggable
              onDragEnd={handleWideBlockDragEnd}
              onDragStart={(event) => {
                handleWideBlockDragStart(event, row.id, blockIndex);
              }}
              title={`ลาก block ${block.title}`}
              type="button"
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-pressed={isSelected}
              className="min-w-0 text-left"
              onClick={() => {
                onSelectWideBlock(row.id, blockIndex);
              }}
              type="button"
            >
              <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                {block.title}
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--site-muted)]">
                {block.enabled ? "เปิด" : "ปิด"}
                {block.hideWhenEmpty ? " / ซ่อนเมื่อไม่มีข้อมูล" : ""}
              </span>
            </button>
            <button
              aria-label="ลบ block"
              className="inline-flex size-7 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50"
              onClick={() => {
                onRemoveWideBlock(row.id, blockIndex);
              }}
              title="ลบ block"
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <button
            aria-pressed={isSelected}
            className={`flex h-full min-h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center text-sm font-semibold transition ${
              isSelected
                ? "border-[var(--site-primary)] bg-[var(--site-surface)] text-[var(--site-primary)]"
                : "border-[var(--site-border)] text-[var(--site-muted)] hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)]"
            }`}
            onClick={() => {
              onSelectWideBlock(row.id, blockIndex);
            }}
            type="button"
          >
            {isSelected ? "ช่องนี้กำลังเลือก" : "ลาก block ลงช่องนี้"}
            {isSelected ? (
              <span className="text-xs font-medium text-[var(--site-muted)]">
                กด block จากคลังเพื่อใส่ช่องนี้
              </span>
            ) : null}
          </button>
        )}
      </div>
    );
  }

  function renderNarrowZone() {
    return (
      <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--site-text)]">
              ฝั่ง 30
            </h3>
            <p className="mt-0.5 text-xs text-[var(--site-muted)]">
              แถวแคบ วางได้ทีละ 1 block
            </p>
          </div>
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            onClick={onAddNarrowRow}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มแถว 30
          </button>
        </div>

        {layout.mainSplit.narrowRows.length === 0 ? (
          <button
            className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-6 text-center text-sm font-semibold text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface)]"
            onClick={onAddNarrowRow}
            type="button"
          >
            ยังไม่มีแถวในฝั่ง 30
            <span className="mt-1 text-xs font-medium">
              เพิ่มแถวสำหรับ block แนวตั้ง
            </span>
          </button>
        ) : (
          <div className="grid gap-2">
            {layout.mainSplit.narrowRows.map((row, rowIndex) => {
              const isSelected =
                activeSelection?.zone === "narrow" &&
                activeSelection.rowId === row.id;
              const isDragOverSlot = dragOverNarrowRowId === row.id;
              const isDraggingRow = draggingNarrowRowIndex === rowIndex;
              const isDragOverRow =
                dragOverNarrowRowIndex === rowIndex &&
                draggingNarrowRowIndex !== rowIndex;

              return (
                <article
                  className={`rounded-lg border bg-[var(--site-surface-soft)] p-2 transition ${
                    isDragOverRow || isDragOverSlot
                      ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
                      : isSelected
                      ? "border-[var(--site-primary)]"
                      : "border-[var(--site-border)]"
                  } ${row.enabled ? "" : "opacity-60"} ${
                    isDraggingRow ? "opacity-70" : ""
                  }`}
                  key={row.id}
                  onDragEnd={handleRowDragEnd}
                  onDragOver={(event) => {
                    handleNarrowRowDragOver(event, rowIndex);
                  }}
                  onDrop={(event) => {
                    handleNarrowRowDrop(event, rowIndex);
                  }}
                >
                  <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <button
                      aria-label={`ลากแถวฝั่ง 30 ลำดับที่ ${rowIndex + 1}`}
                      className="inline-flex size-8 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
                      draggable
                      onDragEnd={handleRowDragEnd}
                      onDragStart={(event) => {
                        handleNarrowRowDragStart(event, rowIndex);
                      }}
                      title={`ลากแถวฝั่ง 30 ลำดับที่ ${rowIndex + 1}`}
                      type="button"
                    >
                      <GripVertical aria-hidden="true" className="size-4" />
                    </button>

                    <button
                      aria-pressed={isSelected}
                      className="min-w-0 text-left"
                      onClick={() => {
                        onSelectNarrowRow(row.id);
                      }}
                      type="button"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--site-text)]">
                          แถว 30 ที่ {rowIndex + 1}
                        </span>
                        <StatusPill enabled={row.enabled} />
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        aria-label="เลื่อนแถว 30 ขึ้น"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={rowIndex <= 0}
                        onClick={() => {
                          onMoveNarrowRow(rowIndex, rowIndex - 1);
                        }}
                        title="เลื่อนขึ้น"
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="เลื่อนแถว 30 ลง"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          rowIndex >= layout.mainSplit.narrowRows.length - 1
                        }
                        onClick={() => {
                          onMoveNarrowRow(rowIndex, rowIndex + 1);
                        }}
                        title="เลื่อนลง"
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label={row.enabled ? "ปิดแถว 30" : "เปิดแถว 30"}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                        onClick={() => {
                          onToggleNarrowRow(row.id, !row.enabled);
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
                        aria-label="ลบแถว 30"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
                        onClick={() => {
                          onRemoveNarrowRow(row.id);
                        }}
                        title="ลบแถว"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`min-h-20 rounded-lg border p-2 ${
                      isDragOverSlot
                        ? "border-[var(--site-primary)] bg-[var(--site-surface)]"
                        : isSelected
                        ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                        : "border-dashed border-[var(--site-border)] bg-[var(--site-surface)]"
                    }`}
                    onDragLeave={() => {
                      setDragOverNarrowRowId(null);
                    }}
                    onDragOver={(event) => {
                      handleNarrowSlotDragOver(event, row.id);
                    }}
                    onDrop={(event) => {
                      handleNarrowSlotDrop(event, row.id);
                    }}
                  >
                    {row.block ? (
                      <div className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2">
                        <button
                          className="min-w-0 text-left"
                          onClick={() => {
                            onSelectNarrowRow(row.id);
                          }}
                          type="button"
                        >
                          <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                            {row.block.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[var(--site-muted)]">
                            {row.block.enabled ? "เปิด" : "ปิด"}
                            {row.block.hideWhenEmpty
                              ? " / ซ่อนเมื่อไม่มีข้อมูล"
                              : ""}
                          </span>
                        </button>
                        <button
                          aria-label="ลบ block"
                          className="inline-flex size-7 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50"
                          onClick={() => {
                            onRemoveNarrowBlock(row.id);
                          }}
                          title="ลบ block"
                          type="button"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex min-h-16 w-full flex-col items-center justify-center rounded-md border border-dashed border-[var(--site-border)] px-3 py-4 text-center text-sm font-semibold text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)]"
                        onClick={() => {
                          onSelectNarrowRow(row.id);
                        }}
                        type="button"
                      >
                        ลาก block ลงแถวนี้
                        <span className="mt-1 text-xs font-medium">
                          ฝั่ง 30 รับได้ทีละ 1 block
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] shadow-sm">
      <div className="border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--site-text)]">
          โครงหน้า Details
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
          พื้นที่ด้านบนและบ้านพักแนะนำถูกล็อกไว้ จัดได้เฉพาะฝั่ง 70 และฝั่ง 30
        </p>
      </div>

      <div className="grid gap-3 p-3">
        <LockedShell label="ล็อกไว้ด้านบน">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3">
              <p className="text-sm font-semibold text-[var(--site-text)]">
                Gallery
              </p>
              <p className="mt-0.5 text-xs text-[var(--site-muted)]">
                รูปหลักและแกลเลอรีบ้านพัก
              </p>
            </div>
            <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3">
              <p className="text-sm font-semibold text-[var(--site-text)]">
                ชื่อบ้าน / ราคา
              </p>
              <p className="mt-0.5 text-xs text-[var(--site-muted)]">
                ข้อมูลเริ่มต้นและปุ่มติดต่อหลัก
              </p>
            </div>
          </div>
        </LockedShell>

        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--site-text)]">
                พื้นที่จัดหน้า
              </p>
              <p className="mt-0.5 text-xs text-[var(--site-muted)]">
                เลือกตำแหน่งของฝั่งกว้างและฝั่งแคบ
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-1">
              {DETAIL_LAYOUT_OUTER_SPLIT_RATIOS.map((ratio) => (
                <button
                  className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                    layout.mainSplit.ratio === ratio
                      ? "bg-[var(--site-surface)] text-[var(--site-primary)] shadow-sm"
                      : "text-[var(--site-muted)] hover:text-[var(--site-text)]"
                  }`}
                  key={ratio}
                  onClick={() => {
                    onOuterRatioChange(ratio);
                  }}
                  type="button"
                >
                  <ArrowLeftRight aria-hidden="true" className="size-4" />
                  {ratio === "70/30" ? "70 ซ้าย / 30 ขวา" : "30 ซ้าย / 70 ขวา"}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`mt-3 grid gap-3 ${
              isWideLeft
                ? "lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]"
                : "lg:grid-cols-[minmax(280px,3fr)_minmax(0,7fr)]"
            }`}
          >
            {isWideLeft ? (
              <>
                {wideZone}
                {narrowZone}
              </>
            ) : (
              <>
                {narrowZone}
                {wideZone}
              </>
            )}
          </div>
        </div>

        <LockedShell label="ล็อกไว้ด้านล่าง">
          <div className="grid gap-2">
            {layout.lockedBottom.map((block, blockIndex) => {
              const isSelected =
                activeSelection?.zone === "lockedBottom" &&
                activeSelection.blockIndex === blockIndex;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`grid w-full grid-cols-[auto_1fr] items-center gap-2 rounded-md border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                      : "border-[var(--site-border)] bg-[var(--site-surface-soft)] hover:bg-[var(--site-surface)]"
                  }`}
                  key={`${block.type}-${blockIndex}`}
                  onClick={() => {
                    onSelectLockedBottomBlock(blockIndex);
                  }}
                  type="button"
                >
                  <PanelTop
                    aria-hidden="true"
                    className="size-4 text-[var(--site-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                      บ้านพักแนะนำ
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--site-muted)]">
                      ส่วนล็อกเต็มความกว้าง
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </LockedShell>

        <div className="rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--site-text)]">
                เพิ่มแถวใหม่
              </p>
              <p className="mt-0.5 text-xs text-[var(--site-muted)]">
                เพิ่มแถวลงฝั่ง 70 หรือฝั่ง 30 แล้วลาก block จากคลัง
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={() => {
                  onAddWideRow(1);
                }}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                แถว 70 / 1 ช่อง
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={() => {
                  onAddWideRow(2, "50/50");
                }}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                แถว 70 / 50-50
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
                onClick={onAddNarrowRow}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                แถว 30
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
