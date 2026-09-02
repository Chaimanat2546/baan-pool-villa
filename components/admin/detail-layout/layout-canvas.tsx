"use client";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { UniqueIdentifier } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { DETAIL_LAYOUT_OUTER_SPLIT_RATIOS } from "@/lib/detail-layout/defaults";

import type {
  DetailLayoutBlockType,
  DetailLayoutOuterRatio,
  DetailLayoutV2Draft,
  DetailLayoutV2DraftWideRow,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
} from "./types";

const WIDE_ROW_OPTIONS: Array<{
  columns: DetailLayoutWideColumns;
  label: string;
  ratio?: DetailLayoutWideRatio;
}> = [
  { columns: 1, label: "1 ช่อง" },
  { columns: 2, label: "2 ช่อง", ratio: "50/50" },
];

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
  disabled?: boolean;
  errorMessagesByTarget?: Record<string, string[]>;
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
  onMoveNarrowBlock: (fromRowId: string, toRowId: string) => void;
  onMoveNarrowBlockToWide: (
    fromRowId: string,
    toRowId: string,
    toBlockIndex: number,
  ) => void;
  onMoveWideBlock: (
    fromRowId: string,
    fromBlockIndex: number,
    toRowId: string,
    toBlockIndex: number,
  ) => void;
  onMoveWideBlockToNarrow: (
    fromRowId: string,
    fromBlockIndex: number,
    toRowId: string,
  ) => void;
  onMoveWideRow: (fromIndex: number, toIndex: number) => void;
  onOuterRatioChange: (ratio: DetailLayoutOuterRatio) => void;
  onRemoveNarrowBlock: (rowId: string) => void;
  onRemoveNarrowRow: (rowId: string) => void;
  onRemoveWideBlock: (rowId: string, blockIndex: number) => void;
  onRemoveWideRow: (rowId: string) => void;
  onSelectNarrowRow: (rowId: string) => void;
  onSelectWideBlock: (rowId: string, blockIndex: number) => void;
  onUpdateWideRow: (
    rowId: string,
    columns: DetailLayoutWideColumns,
    ratio?: DetailLayoutWideRatio,
  ) => void;
}

export function getDetailLayoutCanvasRowSortableIds(
  layout: DetailLayoutV2Draft,
): UniqueIdentifier[] {
  return [
    ...layout.mainSplit.wideRows.map((row) => `wide-row:${row.id}`),
    ...layout.mainSplit.narrowRows.map((row) => `narrow-row:${row.id}`),
  ];
}

function SortableCanvasItem({
  children,
  id,
}: {
  children: (item: ReturnType<typeof useSortable>) => ReactNode;
  id: UniqueIdentifier;
}) {
  const item = useSortable({ id });

  return children(item);
}

function DraggableCanvasItem({
  children,
  id,
}: {
  children: (item: ReturnType<typeof useDraggable>) => ReactNode;
  id: UniqueIdentifier;
}) {
  const item = useDraggable({ id });

  return children(item);
}

function CanvasDropTarget({
  children,
  id,
}: {
  children: (target: ReturnType<typeof useDroppable>) => ReactNode;
  id: UniqueIdentifier;
}) {
  const target = useDroppable({ id });

  return children(target);
}

function getWideGridClass(row: DetailLayoutV2DraftWideRow): string {
  if (row.columns === 1) {
    return "grid-cols-1";
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

function renderErrorMessages(errors: string[]) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-2 scroll-mt-52 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-800 lg:scroll-mt-48"
      data-detail-layout-error="true"
      role="alert"
      tabIndex={-1}
    >
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  );
}

export function LayoutCanvas({
  activeSelection,
  disabled = false,
  errorMessagesByTarget = {},
  layout,
  onAddNarrowRow,
  onAddWideRow,
  onDropNarrowBlock,
  onDropWideBlock,
  onMoveNarrowBlock,
  onMoveNarrowBlockToWide,
  onMoveNarrowRow,
  onMoveWideBlock,
  onMoveWideBlockToNarrow,
  onMoveWideRow,
  onOuterRatioChange,
  onRemoveNarrowBlock,
  onRemoveNarrowRow,
  onRemoveWideBlock,
  onRemoveWideRow,
  onSelectNarrowRow,
  onSelectWideBlock,
  onUpdateWideRow,
}: LayoutCanvasProps) {
  const isWideLeft = layout.mainSplit.ratio === "70/30";
  const wideZone = renderWideZone();
  const narrowZone = renderNarrowZone();

  function renderWideZone() {
    return (
      <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--site-text)]">
              ฝั่ง 70
            </h3>
            <p className="mt-0.5 text-xs text-[var(--site-muted)]">
              แถวกว้างเลือกได้ 1 ช่องหรือ 2 ช่อง
            </p>
          </div>
        </div>

        {layout.mainSplit.wideRows.length === 0 ? (
          <button
            className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-4 py-6 text-center text-sm font-semibold text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface)]"
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
          <SortableContext
            items={layout.mainSplit.wideRows.map((row) => `wide-row:${row.id}`)}
            strategy={verticalListSortingStrategy}
          >
          <div className="grid gap-3">
            {layout.mainSplit.wideRows.map((row, rowIndex) =>
              renderWideRow(row, rowIndex),
            )}
          </div>
          </SortableContext>
        )}

        <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)] mt-4 w-full justify-center"
            onClick={() => {
              onAddWideRow(2, "50/50");
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มแถว 70
          </button>
      </section>
    );
  }

  function renderWideRow(
    row: DetailLayoutV2DraftWideRow,
    rowIndex: number,
  ) {
    const rowErrors = errorMessagesByTarget[`${row.id}:row`] ?? [];
    const slotErrors = getSlotIndexes(row.columns).flatMap(
      (blockIndex) => errorMessagesByTarget[`${row.id}:slot:${blockIndex}`] ?? [],
    );
    const displayErrors = [...rowErrors, ...slotErrors];
    const hasRowErrors = rowErrors.length > 0;
    return (
      <SortableCanvasItem id={`wide-row:${row.id}`} key={row.id}>
        {({ attributes, isDragging, isOver, listeners, setNodeRef, transform, transition }) => (
      <article
        className={`rounded-lg border bg-[var(--site-surface-soft)] p-2 transition ${
          hasRowErrors
            ? "border-red-300 ring-2 ring-red-100"
            : isOver
            ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
            : "border-[var(--site-border)]"
        } ${isDragging ? "opacity-70" : ""
        }`}
        key={row.id}
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <button
            aria-label={`ลากแถวที่ ${rowIndex + 1}`}
            className="inline-flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
            {...attributes}
            {...listeners}
            title={`ลากแถวที่ ${rowIndex + 1}`}
            type="button"
            style={{ touchAction: "none" }}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--site-text)]">
                แถวที่ {rowIndex + 1}
              </p>
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

          <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1">
            <button
              aria-label="เลื่อนแถวขึ้น"
              className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
              aria-label="เลื่อนแถวลง"
              className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
              aria-label="ลบแถว"
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
        {renderErrorMessages(displayErrors)}
      </article>
        )}
      </SortableCanvasItem>
    );
  }

  function renderWideSlot(
    row: DetailLayoutV2DraftWideRow,
    blockIndex: number,
  ) {
    const block = row.blocks[blockIndex];
    const slotErrors =
      errorMessagesByTarget[`${row.id}:slot:${blockIndex}`] ?? [];
    const hasSlotErrors = slotErrors.length > 0;
    const isSelected =
      activeSelection?.zone === "wide" &&
      activeSelection.rowId === row.id &&
      activeSelection.blockIndex === blockIndex;
    return (
      <CanvasDropTarget
        id={`wide-slot:${row.id}:${blockIndex}`}
        key={`${row.id}-${blockIndex}`}
      >
        {({ isOver, setNodeRef }) => (
      <div
        className={`min-h-24 rounded-lg border p-2 transition ${
          hasSlotErrors
            ? "border-red-300 bg-red-50/40 ring-2 ring-red-100"
            : isOver
            ? "border-[var(--site-primary)] bg-[var(--site-surface)] ring-2 ring-[var(--site-primary)]/15"
            : isSelected
            ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
            : "border-dashed border-[var(--site-border)] bg-[var(--site-surface)]"
        }`}
        ref={setNodeRef}
      >
        {block ? (
          <DraggableCanvasItem id={`wide-block:${row.id}:${blockIndex}`}>
            {({ attributes, isDragging, listeners, setNodeRef: setBlockNodeRef }) => (
          <div
            aria-label={`ลาก block ${block.title}`}
            className={`grid h-full min-h-20 cursor-grab grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2 transition active:cursor-grabbing ${
              isDragging ? "opacity-70" : ""
            }`}
            ref={setBlockNodeRef}
            role="group"
          >
            <button
              aria-label={`ลาก block ${block.title}`}
              className="inline-flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
              title={`ลาก block ${block.title}`}
              type="button"
              {...attributes}
              {...listeners}
              style={{ touchAction: "none" }}
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
            )}
          </DraggableCanvasItem>
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
        )}
      </CanvasDropTarget>
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
        </div>

        {layout.mainSplit.narrowRows.length === 0 ? (
          <button
            className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-4 py-6 text-center text-sm font-semibold text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface)]"
            onClick={onAddNarrowRow}
            type="button"
          >
            ยังไม่มีแถวในฝั่ง 30
            <span className="mt-1 text-xs font-medium">
              เพิ่มแถวสำหรับ block แนวตั้ง
            </span>
          </button>
        ) : (
          <SortableContext
            items={layout.mainSplit.narrowRows.map((row) => `narrow-row:${row.id}`)}
            strategy={verticalListSortingStrategy}
          >
          <div className="grid gap-2">
            {layout.mainSplit.narrowRows.map((row, rowIndex) => {
              const narrowBlock = row.block;
              const isSelected =
                activeSelection?.zone === "narrow" &&
                activeSelection.rowId === row.id;
              const rowErrors = errorMessagesByTarget[`${row.id}:row`] ?? [];
              const hasRowErrors = rowErrors.length > 0;
              return (
                <SortableCanvasItem id={`narrow-row:${row.id}`} key={row.id}>
                  {({ attributes, isDragging, isOver, listeners, setNodeRef, transform, transition }) => (
                <article
                  className={`rounded-lg border bg-[var(--site-surface-soft)] p-2 transition ${
                    hasRowErrors
                      ? "border-red-300 ring-2 ring-red-100"
                      : isOver
                      ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
                      : isSelected
                      ? "border-[var(--site-primary)]"
                      : "border-[var(--site-border)]"
                  } ${isDragging ? "opacity-70" : ""
                  }`}
                  ref={setNodeRef}
                  style={{ transform: CSS.Transform.toString(transform), transition }}
                >
                  <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <button
                      aria-label={`ลากแถวที่ ${rowIndex + 1}`}
                      className="inline-flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-primary)] active:cursor-grabbing"
                      {...attributes}
                      {...listeners}
                      title={`ลากแถวที่ ${rowIndex + 1}`}
                      type="button"
                      style={{ touchAction: "none" }}
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
                          แถวที่ {rowIndex + 1}
                        </span>
                      </span>
                    </button>

                    <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1">
                      <button
                        aria-label="เลื่อนแถวขึ้น"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
                        aria-label="เลื่อนแถวลง"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
                        aria-label="ลบแถว"
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

                  <CanvasDropTarget id={`narrow-slot:${row.id}`}>
                    {({ isOver: isDragOverSlot, setNodeRef: setSlotNodeRef }) => (
                  <div
                    className={`min-h-20 rounded-lg border p-2 ${
                      isDragOverSlot
                        ? "border-[var(--site-primary)] bg-[var(--site-surface)]"
                        : isSelected
                        ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                        : "border-dashed border-[var(--site-border)] bg-[var(--site-surface)]"
                    }`}
                    ref={setSlotNodeRef}
                  >
                    {narrowBlock ? (
                      <DraggableCanvasItem id={`narrow-block:${row.id}`}>
                        {({ attributes: blockAttributes, isDragging: isDraggingBlock, listeners: blockListeners, setNodeRef: setBlockNodeRef }) => (
                      <div
                        aria-label={`ลาก block ${narrowBlock.title}`}
                        className={`grid min-h-16 max-w-full cursor-grab grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-2 transition active:cursor-grabbing ${
                          isDraggingBlock ? "opacity-70" : ""
                        }`}
                        ref={setBlockNodeRef}
                        role="group"
                      >
                        <button
                          aria-label={`ลาก block ${narrowBlock.title}`}
                          className="inline-flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] active:cursor-grabbing"
                          type="button"
                          {...blockAttributes}
                          {...blockListeners}
                          style={{ touchAction: "none" }}
                        >
                          <GripVertical aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          className="min-w-0 text-left"
                          onClick={() => {
                            onSelectNarrowRow(row.id);
                          }}
                          type="button"
                        >
                          <span className="block truncate text-sm font-semibold text-[var(--site-text)]">
                            {narrowBlock.title}
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
                        )}
                      </DraggableCanvasItem>
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
                    )}
                  </CanvasDropTarget>
                  {renderErrorMessages(rowErrors)}
                </article>
                  )}
                </SortableCanvasItem>
              );
            })}
          </div>
          </SortableContext>
        )}
        <button
            className=" mt-4 w-full justify-center inline-flex h-8 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)]"
            onClick={onAddNarrowRow}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มแถว 30
          </button>
      </section>
    );
  }

  return (
    <fieldset
      className={disabled ? "pointer-events-none opacity-60" : undefined}
      disabled={disabled}
    >
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="inline-flex rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-1">
          {DETAIL_LAYOUT_OUTER_SPLIT_RATIOS.map((ratio) => (
            <button
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                layout.mainSplit.ratio === ratio
                  ? "bg-[var(--site-surface)] text-[var(--site-primary)]"
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
        className={`grid gap-3 ${
          isWideLeft
            ? "xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]"
            : "xl:grid-cols-[minmax(280px,3fr)_minmax(0,7fr)]"
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
    </fieldset>
  );
}
