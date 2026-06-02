"use client";

import { Lock, SlidersHorizontal, Trash2 } from "lucide-react";

import type { DetailLayoutCanvasSelection } from "./layout-canvas";
import type {
  DetailLayoutBlock,
  DetailLayoutV2Draft,
  DetailLayoutV2DraftNarrowRow,
  DetailLayoutV2DraftWideRow,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
} from "./types";

interface RowSettingsPanelProps {
  layout: DetailLayoutV2Draft;
  selection: DetailLayoutCanvasSelection;
  onRemoveNarrowBlock: (rowId: string) => void;
  onRemoveWideBlock: (rowId: string, blockIndex: number) => void;
  onSelectWideBlock: (rowId: string, blockIndex: number) => void;
  onUpdateNarrowBlock: (
    rowId: string,
    changes: Partial<Omit<DetailLayoutBlock, "type">>,
  ) => void;
  onUpdateNarrowRow: (
    rowId: string,
    changes: Partial<Pick<DetailLayoutV2DraftNarrowRow, "enabled">>,
  ) => void;
  onUpdateWideBlock: (
    rowId: string,
    blockIndex: number,
    changes: Partial<Omit<DetailLayoutBlock, "type">>,
  ) => void;
  onUpdateWideRow: (
    rowId: string,
    columns: DetailLayoutWideColumns,
    ratio?: DetailLayoutWideRatio,
  ) => void;
  onUpdateWideRowEnabled: (rowId: string, enabled: boolean) => void;
}

const WIDE_LAYOUT_OPTIONS: Array<{
  columns: DetailLayoutWideColumns;
  label: string;
  ratio?: DetailLayoutWideRatio;
}> = [
  { columns: 1, label: "1 ช่อง" },
  { columns: 2, label: "2 ช่อง", ratio: "50/50" },
];

function getWideAreaLabel(
  layout: DetailLayoutV2Draft,
  row: DetailLayoutV2DraftWideRow,
) {
  const rowIndex = layout.mainSplit.wideRows.findIndex(
    (candidate) => candidate.id === row.id,
  );

  return rowIndex >= 0 ? `ฝั่ง 70 / แถว ${rowIndex + 1}` : "ฝั่ง 70";
}

function getNarrowAreaLabel(
  layout: DetailLayoutV2Draft,
  row: DetailLayoutV2DraftNarrowRow,
) {
  const rowIndex = layout.mainSplit.narrowRows.findIndex(
    (candidate) => candidate.id === row.id,
  );

  return rowIndex >= 0 ? `ฝั่ง 30 / ลำดับ ${rowIndex + 1}` : "ฝั่ง 30";
}

function isWideLayoutActive(
  row: DetailLayoutV2DraftWideRow,
  option: (typeof WIDE_LAYOUT_OPTIONS)[number],
) {
  if (option.columns === 1) {
    return row.columns === 1;
  }

  return row.columns === 2 && row.ratio === option.ratio;
}

function BlockEditor({
  block,
  onRemove,
  onUpdate,
}: {
  block: DetailLayoutBlock;
  onRemove: () => void;
  onUpdate: (changes: Partial<Omit<DetailLayoutBlock, "type">>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
      <label className="grid gap-2 text-sm font-semibold text-[var(--site-text)]">
        ชื่อที่แสดง
        <input
          className="h-10 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          onChange={(event) => {
            onUpdate({ title: event.target.value });
          }}
          value={block.title}
        />
      </label>

      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 bg-[var(--site-surface)] px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        onClick={onRemove}
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-4" />
        ลบ block
      </button>
    </div>
  );
}

function EmptyPanel() {
  return (
    <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
        <SlidersHorizontal
          aria-hidden="true"
          className="size-4 text-[var(--site-primary)]"
        />
        ตั้งค่าพื้นที่
      </h2>
      <p className="mt-3 rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-3 py-5 text-sm leading-6 text-[var(--site-muted)]">
        เลือกฝั่ง 70, ฝั่ง 30 หรือส่วนบ้านพักแนะนำในผังเพื่อแก้การแสดงผล
      </p>
    </section>
  );
}

export function RowSettingsPanel({
  layout,
  selection,
  onRemoveNarrowBlock,
  onRemoveWideBlock,
  onSelectWideBlock,
  onUpdateNarrowBlock,
  onUpdateNarrowRow,
  onUpdateWideBlock,
  onUpdateWideRow,
  onUpdateWideRowEnabled,
}: RowSettingsPanelProps) {
  if (!selection) {
    return <EmptyPanel />;
  }

  if (selection.zone === "lockedBottom") {
    const block = layout.lockedBottom[selection.blockIndex] ?? null;

    return (
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
          <Lock
            aria-hidden="true"
            className="size-4 text-[var(--site-primary)]"
          />
          บ้านพักแนะนำ: ล็อกเต็มความกว้าง
        </h2>
        <div className="mt-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3 text-sm leading-6">
          <p className="font-semibold text-[var(--site-text)]">
            {block?.title ?? "บ้านพักแนะนำ"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
            ส่วนนี้ถูกล็อกไว้ด้านล่างของหน้าเพื่อให้คำแนะนำบ้านพักแสดงเต็มความกว้าง
            จึงไม่มีการแก้แถวหรือเพิ่ม block จากแผงนี้
          </p>
        </div>
      </section>
    );
  }

  if (selection.zone === "narrow") {
    const row =
      layout.mainSplit.narrowRows.find(
        (candidate) => candidate.id === selection.rowId,
      ) ?? null;

    if (!row) {
      return <EmptyPanel />;
    }

    return (
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
          <SlidersHorizontal
            aria-hidden="true"
            className="size-4 text-[var(--site-primary)]"
          />
          ตั้งค่าพื้นที่
        </h2>
        <p className="mt-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--site-muted)]">
          {getNarrowAreaLabel(layout, row)}
        </p>

        <div className="mt-4 grid gap-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--site-text)]">
            เปิดใช้แถว
            <input
              checked={row.enabled}
              className="size-4 accent-[var(--site-primary)]"
              onChange={(event) => {
                onUpdateNarrowRow(row.id, { enabled: event.target.checked });
              }}
              type="checkbox"
            />
          </label>

          {row.block ? (
            <BlockEditor
              block={row.block}
              onRemove={() => {
                onRemoveNarrowBlock(row.id);
              }}
              onUpdate={(changes) => {
                onUpdateNarrowBlock(row.id, changes);
              }}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-3 py-4 text-sm leading-6 text-[var(--site-muted)]">
              ฝั่ง 30 รับได้ทีละ 1 block เลือก block จากคลังด้านซ้ายเพื่อใส่ในแถวนี้
            </p>
          )}
        </div>
      </section>
    );
  }

  const row =
    layout.mainSplit.wideRows.find(
      (candidate) => candidate.id === selection.rowId,
    ) ?? null;

  if (!row) {
    return <EmptyPanel />;
  }

  const activeBlock = row.blocks[selection.blockIndex] ?? null;

  return (
    <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
        <SlidersHorizontal
          aria-hidden="true"
          className="size-4 text-[var(--site-primary)]"
        />
        ตั้งค่าพื้นที่
      </h2>
      <p className="mt-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--site-muted)]">
        {getWideAreaLabel(layout, row)}
      </p>

      <div className="mt-4 grid gap-4">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--site-text)]">
          เปิดใช้แถว
          <input
            checked={row.enabled}
            className="size-4 accent-[var(--site-primary)]"
            onChange={(event) => {
              onUpdateWideRowEnabled(row.id, event.target.checked);
            }}
            type="checkbox"
          />
        </label>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-[var(--site-text)]">
            รูปแบบแถว
          </p>
          <div className="grid grid-cols-2 gap-2">
            {WIDE_LAYOUT_OPTIONS.map((option) => {
              const isActive = isWideLayoutActive(row, option);

              return (
                <button
                  aria-pressed={isActive}
                  className={`h-9 rounded-md border px-2 text-sm font-semibold transition ${
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
          {row.columns === 2 ? (
            <p className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--site-muted)]">
              แถว 2 ช่องใช้ 50/50 เสมอ
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-[var(--site-text)]">
            Block ในแถว
          </p>
          {row.blocks.map((block, blockIndex) => {
            const isActive = blockIndex === selection.blockIndex;

            return (
              <button
                aria-pressed={isActive}
                className={`grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                    : "border-[var(--site-border)] bg-[var(--site-surface-soft)] hover:bg-[var(--site-surface)]"
                }`}
                key={`${row.id}-${blockIndex}`}
                onClick={() => {
                  onSelectWideBlock(row.id, blockIndex);
                }}
                type="button"
              >
                <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--site-text)]">
                  {blockIndex + 1}. {block?.title ?? "ช่องว่าง"}
                </span>
                <span className="text-xs font-semibold text-[var(--site-muted)]">
                  {block ? "มี block" : "ว่าง"}
                </span>
              </button>
            );
          })}
        </div>

        {activeBlock ? (
          <BlockEditor
            block={activeBlock}
            onRemove={() => {
              onRemoveWideBlock(row.id, selection.blockIndex);
            }}
            onUpdate={(changes) => {
              onUpdateWideBlock(row.id, selection.blockIndex, changes);
            }}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-3 py-4 text-sm leading-6 text-[var(--site-muted)]">
            ช่องนี้ยังว่าง เลือก block จากคลังด้านซ้ายเพื่อใส่ในตำแหน่งที่เลือก
          </p>
        )}
      </div>
    </section>
  );
}
