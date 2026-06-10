"use client";

import { Blocks, ListChecks, Plus } from "lucide-react";
import type { DragEvent } from "react";

import { DETAIL_LAYOUT_BLOCK_LABELS } from "@/lib/detail-layout/defaults";
import { DETAIL_LAYOUT_BLOCK_TYPES } from "@/lib/detail-layout/types";

import type { DetailLayoutBlockType } from "./types";

interface BlockLibraryProps {
  onAddBlock: (type: DetailLayoutBlockType) => void;
  onDragStart: (type: DetailLayoutBlockType) => void;
  targetLabel: string;
  usedBlockTypes: DetailLayoutBlockType[];
}

export function BlockLibrary({
  onAddBlock,
  onDragStart,
  targetLabel,
  usedBlockTypes,
}: BlockLibraryProps) {
  const usedBlockTypeSet = new Set(usedBlockTypes);
  const availableBlockTypes = DETAIL_LAYOUT_BLOCK_TYPES.filter(
    (type) => !usedBlockTypeSet.has(type),
  );

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    type: DetailLayoutBlockType,
  ) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", type);
    onDragStart(type);
  }

  return (
    <aside className="grid rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="border-b border-[var(--site-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
              <Blocks
                aria-hidden="true"
                className="size-4 text-[var(--site-primary)]"
              />
              เพิ่มส่วนข้อมูล
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
              กดเพื่อลากไปยังตำแหน่งที่เลือก
            </p>
          </div>
          <span className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-primary)]">
            {availableBlockTypes.length} รายการ
          </span>
        </div>
      </div>

      <div className="mx-4 mt-4 max-w-full overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--site-muted)]">
        <span className="font-medium">ลงที่: </span>
        <span className="font-semibold text-[var(--site-text)]">{targetLabel}</span>
      </div>

      <div className="mx-4 mt-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-[var(--site-text)]">
          <ListChecks
            aria-hidden="true"
            className="size-4 text-[var(--site-primary)]"
          />
          ลำดับการทำงาน
        </h2>
        <ol className="mt-2 grid gap-1.5 text-xs leading-5 text-[var(--site-muted)]">
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--site-primary)] text-[var(--site-on-primary)]">
              1
            </span>
            <span>เลือกช่องในผัง</span>
          </li>
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--site-primary)] text-[var(--site-on-primary)]">
              2
            </span>
            <span>เพิ่มหรือวาง block</span>
          </li>
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--site-primary)] text-[var(--site-on-primary)]">
              3
            </span>
            <span>แก้ชื่อและการแสดงผลด้านขวา</span>
          </li>
        </ol>
      </div>

      <div className="mt-3 grid content-start gap-2 px-4 pb-4">
        {availableBlockTypes.length > 0 ? (
          availableBlockTypes.map((type) => (
          <button
            className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)]"
            draggable
            key={type}
            onClick={() => {
              onAddBlock(type);
            }}
            onDragStart={(event) => {
              handleDragStart(event, type);
            }}
            type="button"
          >
            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--site-text)]">
              {DETAIL_LAYOUT_BLOCK_LABELS[type]}
            </span>
            <Plus
              aria-hidden="true"
              className="size-4 shrink-0 justify-self-end text-[var(--site-primary)]"
            />
          </button>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-3 py-5 text-sm leading-6 text-[var(--site-muted)]">
            <p className="font-semibold text-[var(--site-text)]">ใช้ block ครบแล้ว</p>
            <p className="mt-1 text-xs">
              ถ้าต้องการเพิ่มอีก ให้ลบ block ออกจากผังก่อน แล้วรายการจะกลับมาให้เลือก
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
