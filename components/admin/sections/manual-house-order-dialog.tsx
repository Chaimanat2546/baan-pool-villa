"use client";

import { ArrowDown, ArrowUp, GripVertical, ImageOff } from "lucide-react";
import Image from "next/image";
import {
  type DragEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ManualHouseOrderOption = {
  coverImage: string | null;
  id: string;
  title: string;
};

type ManualHouseOrderDialogProps = {
  houses: ManualHouseOrderOption[];
  onConfirm: (nextHouseIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function moveId(ids: string[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= ids.length) return ids;

  const nextIds = [...ids];
  const [movedId] = nextIds.splice(fromIndex, 1);

  nextIds.splice(toIndex, 0, movedId);
  return nextIds;
}

export function ManualHouseOrderDialog({
  houses,
  onConfirm,
  onOpenChange,
  open,
}: ManualHouseOrderDialogProps) {
  const sourceHouseIds = useMemo(() => houses.map((house) => house.id), [houses]);

  if (!open) return null;

  return (
    <PendingHouseOrder
      houses={houses}
      initialHouseIds={sourceHouseIds}
      key={sourceHouseIds.join("|")}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />
  );
}

type PendingHouseOrderProps = Omit<ManualHouseOrderDialogProps, "open"> & {
  initialHouseIds: string[];
};

function PendingHouseOrder({
  houses,
  initialHouseIds,
  onConfirm,
  onOpenChange,
}: PendingHouseOrderProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const housesById = useMemo(
    () => new Map(houses.map((house) => [house.id, house])),
    [houses],
  );
  const [pendingHouseIds, setPendingHouseIds] = useState(initialHouseIds);
  const [draggedHouseId, setDraggedHouseId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const inertSiblings = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = dialog;

    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          inertSiblings.set(sibling, sibling.hasAttribute("inert"));
          sibling.setAttribute("inert", "");
        }
      }
      branch = branch.parentElement;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute("hidden") &&
          element.getAttribute("aria-hidden") !== "true",
      );
    const focusFirst = () => {
      getFocusableElements()[0]?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) {
        focusFirst();
      }
    };

    (
      dialog.querySelector<HTMLElement>("[data-manual-house-order-cancel]") ??
      getFocusableElements()[0]
    )?.focus();
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      for (const [element, wasInert] of inertSiblings) {
        if (!wasInert) element.removeAttribute("inert");
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onOpenChange]);

  return (
    <div
      aria-labelledby="manual-house-order-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-xl">
        <header className="border-b border-[var(--site-border)] px-4 py-3">
          <h2
            className="text-lg font-bold text-[var(--site-text)]"
            id="manual-house-order-dialog-title"
          >
            เรียงลำดับบ้าน
          </h2>
          <p className="mt-1 text-sm text-[var(--site-muted)]">
            ลากการ์ดหรือใช้ปุ่มลูกศรเพื่อจัดลำดับบ้านพักในชุดนี้
          </p>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-2">
            {pendingHouseIds.map((houseId, index) => {
              const house = housesById.get(houseId);
              const label = house?.title ?? `บ้าน ${houseId}`;
              const coverImage = house?.coverImage ?? null;

              const handleDragStart = (event: DragEvent<HTMLElement>) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", houseId);
                setDraggedHouseId(houseId);
              };

              const handleDrop = (event: DragEvent<HTMLElement>) => {
                event.preventDefault();

                if (!draggedHouseId || draggedHouseId === houseId) {
                  setDraggedHouseId(null);
                  return;
                }

                setPendingHouseIds((ids) => {
                  const fromIndex = ids.indexOf(draggedHouseId);
                  const toIndex = ids.indexOf(houseId);

                  return fromIndex === -1 || toIndex === -1
                    ? ids
                    : moveId(ids, fromIndex, toIndex);
                });
                setDraggedHouseId(null);
              };

              return (
                <article
                  aria-label={`${label} ลากเพื่อเปลี่ยนลำดับ`}
                  className={`flex min-h-[72px] min-w-0 items-center gap-2.5 rounded-xl border bg-[var(--site-surface-soft)] p-2 transition sm:gap-3 ${
                    draggedHouseId === houseId
                      ? "border-[var(--site-primary)] opacity-60"
                      : "border-[var(--site-border)]"
                  }`}
                  data-house-id={houseId}
                  draggable
                  key={houseId}
                  onDragEnd={() => setDraggedHouseId(null)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--site-primary)]/10 text-sm font-bold text-[var(--site-primary)]">
                    #{index + 1}
                  </span>
                  <GripVertical
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[var(--site-muted)]"
                  />
                  {coverImage ? (
                    <Image
                      alt={`รูปปก ${label}`}
                      className="size-14 shrink-0 rounded-lg border border-[var(--site-border)] object-cover"
                      height={56}
                      src={coverImage}
                      width={56}
                    />
                  ) : (
                    <span
                      aria-label={`ไม่มีรูปปก ${label}`}
                      className="grid size-14 shrink-0 place-items-center rounded-lg border border-dashed border-[var(--site-border)] text-[var(--site-muted)]"
                      role="img"
                    >
                      <ImageOff aria-hidden="true" className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--site-text)]">
                      {label}
                    </p>
                    <p className="truncate text-xs text-[var(--site-muted)]">
                      DV-{houseId}
                    </p>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
                    <button
                      aria-label={`เลื่อนขึ้น ${label}`}
                      className="grid size-9 place-items-center transition disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => {
                        setPendingHouseIds((ids) => moveId(ids, index, index - 1));
                      }}
                      type="button"
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={`เลื่อนลง ${label}`}
                      className="grid size-9 place-items-center border-l border-[var(--site-border)] transition disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === pendingHouseIds.length - 1}
                      onClick={() => {
                        setPendingHouseIds((ids) => moveId(ids, index, index + 1));
                      }}
                      type="button"
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--site-border)] px-4 py-3">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-bold text-[var(--site-text)]"
            data-manual-house-order-cancel
            onClick={() => onOpenChange(false)}
            type="button"
          >
            ยกเลิก
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--site-primary)] px-4 text-sm font-bold text-[var(--site-on-primary)]"
            onClick={() => onConfirm(pendingHouseIds)}
            type="button"
          >
            เสร็จสิ้น
          </button>
        </footer>
      </div>
    </div>
  );
}
