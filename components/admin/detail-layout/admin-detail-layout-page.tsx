"use client";

import {
  CheckCircle2,
  CircleAlert,
  Columns2,
  PanelTop,
  RotateCcw,
  Save,
  Sidebar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import { validateAnyDetailLayout } from "@/lib/detail-layout/compat";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import { BlockLibrary } from "./block-library";
import { makeDetailLayoutBlock } from "./detail-layout-helpers";
import {
  addDetailLayoutV2NarrowRow,
  addDetailLayoutV2WideRow,
  deleteDetailLayoutV2NarrowRow,
  deleteDetailLayoutV2WideRow,
  makeDetailLayoutV2Snapshot,
  moveDetailLayoutV2NarrowRow,
  moveDetailLayoutV2WideRow,
  putDetailLayoutV2NarrowBlock,
  putDetailLayoutV2WideBlockInSlot,
  removeDetailLayoutV2NarrowBlock,
  removeDetailLayoutV2WideBlock,
  toDetailLayoutV2Config,
  toDetailLayoutV2Draft,
  updateDetailLayoutV2NarrowBlock,
  updateDetailLayoutV2NarrowRow,
  updateDetailLayoutV2OuterRatio,
  updateDetailLayoutV2WideBlock,
  updateDetailLayoutV2WideRow,
  updateDetailLayoutV2WideRowColumns,
  validateDetailLayoutV2DraftForSave,
} from "./detail-layout-v2-helpers";
import { LayoutCanvas, type DetailLayoutCanvasSelection } from "./layout-canvas";
import { RowSettingsPanel } from "./row-settings-panel";
import type {
  AdminDetailLayoutResponse,
  DetailLayoutBlockType,
  DetailLayoutV2Draft,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
} from "./types";

const ADMIN_ACCESS_ERROR_PREFIX = "Unable to verify admin access:";
const AUTH_FAILURE_MESSAGES = new Set([
  "Invalid or expired Supabase session. Please sign in again.",
  "Signed-in user is not listed as an active home config admin.",
]);

function extractErrors(payload: unknown, fallback: string): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const errorPayload = payload as AdminDetailLayoutResponse;

  if (Array.isArray(errorPayload.errors)) {
    const errors = errorPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return errors;
    }
  }

  if (typeof errorPayload.error === "string" && errorPayload.error) {
    const detailParts = [
      typeof errorPayload.code === "string" ? errorPayload.code : null,
      typeof errorPayload.details === "string" ? errorPayload.details : null,
      typeof errorPayload.hint === "string" ? errorPayload.hint : null,
    ].filter(Boolean);

    return [
      detailParts.length > 0
        ? `${errorPayload.error} (${detailParts.join(" / ")})`
        : errorPayload.error,
    ];
  }

  return [fallback];
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function shouldRedirectToLogin(
  status: number,
  payload: AdminDetailLayoutResponse | null,
): boolean {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = payload?.error;

  return (
    typeof message === "string" &&
    (AUTH_FAILURE_MESSAGES.has(message) ||
      message.startsWith(ADMIN_ACCESS_ERROR_PREFIX))
  );
}

function findWideRow(layout: DetailLayoutV2Draft | null, rowId: string | null) {
  if (!layout || !rowId) {
    return null;
  }

  return layout.mainSplit.wideRows.find((row) => row.id === rowId) ?? null;
}

function findNarrowRow(layout: DetailLayoutV2Draft | null, rowId: string | null) {
  if (!layout || !rowId) {
    return null;
  }

  return layout.mainSplit.narrowRows.find((row) => row.id === rowId) ?? null;
}

function getDefaultSelection(
  layout: DetailLayoutV2Draft,
): DetailLayoutCanvasSelection {
  const firstWideRow = layout.mainSplit.wideRows[0];

  if (firstWideRow) {
    return { zone: "wide", rowId: firstWideRow.id, blockIndex: 0 };
  }

  const firstNarrowRow = layout.mainSplit.narrowRows[0];

  if (firstNarrowRow) {
    return { zone: "narrow", rowId: firstNarrowRow.id };
  }

  return layout.lockedBottom.length > 0
    ? { zone: "lockedBottom", blockIndex: 0 }
    : null;
}

function normalizeSelection(
  layout: DetailLayoutV2Draft,
  selection: DetailLayoutCanvasSelection,
): DetailLayoutCanvasSelection {
  if (!selection) {
    return getDefaultSelection(layout);
  }

  if (selection.zone === "wide") {
    const row = findWideRow(layout, selection.rowId);

    if (row) {
      return {
        ...selection,
        blockIndex: Math.min(selection.blockIndex, row.columns - 1),
      };
    }
  }

  if (selection.zone === "narrow" && findNarrowRow(layout, selection.rowId)) {
    return selection;
  }

  if (
    selection.zone === "lockedBottom" &&
    selection.blockIndex < layout.lockedBottom.length
  ) {
    return selection;
  }

  return getDefaultSelection(layout);
}

function getWideSlotLabel(columns: DetailLayoutWideColumns, blockIndex: number) {
  if (columns === 1) {
    return "ช่องเดียว";
  }

  return blockIndex === 0 ? "ช่องซ้าย" : "ช่องขวา";
}

function getPlacementLabel(
  layout: DetailLayoutV2Draft | null,
  selection: DetailLayoutCanvasSelection,
): string {
  if (!layout || !selection) {
    return "เลือกพื้นที่ก่อน";
  }

  if (selection.zone === "lockedBottom") {
    return "บ้านพักแนะนำ / ล็อกเต็มความกว้าง";
  }

  if (selection.zone === "wide") {
    const rowIndex = layout.mainSplit.wideRows.findIndex(
      (row) => row.id === selection.rowId,
    );
    const row = rowIndex >= 0 ? layout.mainSplit.wideRows[rowIndex] : null;

    if (!row) {
      return "เลือกพื้นที่ก่อน";
    }

    return `ฝั่ง 70 / แถว ${rowIndex + 1} / ${getWideSlotLabel(
      row.columns,
      selection.blockIndex,
    )}`;
  }

  const rowIndex = layout.mainSplit.narrowRows.findIndex(
    (row) => row.id === selection.rowId,
  );

  return rowIndex >= 0 ? `ฝั่ง 30 / ลำดับ ${rowIndex + 1}` : "เลือกพื้นที่ก่อน";
}

function moveWideBlock(
  layout: DetailLayoutV2Draft,
  fromRowId: string,
  fromBlockIndex: number,
  toRowId: string,
  toBlockIndex: number,
) {
  const fromRow = findWideRow(layout, fromRowId);
  const block = fromRow?.blocks[fromBlockIndex] ?? null;

  if (!fromRow || !block) {
    return layout;
  }

  if (fromRowId === toRowId && fromBlockIndex === toBlockIndex) {
    return layout;
  }

  const toRow = findWideRow(layout, toRowId);
  const targetBlock = toRow?.blocks[toBlockIndex] ?? null;
  const clearedLayout = removeDetailLayoutV2WideBlock(
    layout,
    fromRowId,
    fromBlockIndex,
  );
  const swappedLayout = targetBlock
    ? putDetailLayoutV2WideBlockInSlot(
        clearedLayout,
        fromRowId,
        fromBlockIndex,
        targetBlock,
      )
    : clearedLayout;

  return putDetailLayoutV2WideBlockInSlot(
    swappedLayout,
    toRowId,
    toBlockIndex,
    block,
  );
}

export function AdminDetailLayoutPage() {
  const router = useRouter();
  const [layout, setLayout] = useState<DetailLayoutV2Draft | null>(null);
  const [activeSelection, setActiveSelection] =
    useState<DetailLayoutCanvasSelection>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const activePlacementLabel = useMemo(
    () => getPlacementLabel(layout, activeSelection),
    [activeSelection, layout],
  );
  const activeBlockTitle = useMemo(() => {
    if (!layout || !activeSelection) {
      return null;
    }

    if (activeSelection.zone === "wide") {
      return (
        findWideRow(layout, activeSelection.rowId)?.blocks[
          activeSelection.blockIndex
        ]?.title ?? null
      );
    }

    if (activeSelection.zone === "narrow") {
      return findNarrowRow(layout, activeSelection.rowId)?.block?.title ?? null;
    }

    return layout.lockedBottom[activeSelection.blockIndex]?.title ?? null;
  }, [activeSelection, layout]);
  const hasUnsavedChanges = useMemo(() => {
    if (!layout || savedSnapshot === null) {
      return false;
    }

    return makeDetailLayoutV2Snapshot(layout) !== savedSnapshot;
  }, [layout, savedSnapshot]);

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserHomeConfigClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (error || !token) {
      redirectToLogin();
      return null;
    }

    return token;
  }, [redirectToLogin]);

  const loadLayout = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);
      setNotice(null);

      try {
        const response = await fetch("/api/admin/detail-layout", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await readJsonPayload(
          response,
        )) as AdminDetailLayoutResponse | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload?.layout) {
          setErrors(extractErrors(payload, "โหลด layout หน้า Details ไม่ได้"));
          return;
        }

        const nextLayout = toDetailLayoutV2Draft(payload.layout);

        setLayout(nextLayout);
        setSavedSnapshot(makeDetailLayoutV2Snapshot(nextLayout));
        setActiveSelection(getDefaultSelection(nextLayout));
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "โหลด layout หน้า Details ไม่ได้",
        ]);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const token = await getAccessToken();

        if (!token || !isMounted) {
          return;
        }

        await loadLayout(token, true);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "เริ่มหน้าจัด layout หน้า Details ไม่ได้",
        ]);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadLayout]);

  useEffect(() => {
    if (!layout) {
      return;
    }

    setActiveSelection((currentSelection) =>
      normalizeSelection(layout, currentSelection),
    );
  }, [layout]);

  function updateLayout(
    updater: (currentLayout: DetailLayoutV2Draft) => DetailLayoutV2Draft,
    nextSelection?: DetailLayoutCanvasSelection,
  ) {
    setNotice(null);
    setErrors([]);
    setLayout((currentLayout) => {
      if (!currentLayout) {
        return currentLayout;
      }

      return updater(currentLayout);
    });

    if (nextSelection !== undefined) {
      setActiveSelection(nextSelection);
    }
  }

  function handleAddWideRow(
    columns: DetailLayoutWideColumns,
    ratio?: DetailLayoutWideRatio,
  ) {
    if (!layout) {
      return;
    }

    const nextLayout = addDetailLayoutV2WideRow(layout, columns, ratio);
    const nextRow = nextLayout.mainSplit.wideRows.at(-1);

    setNotice(null);
    setErrors([]);
    setLayout(nextLayout);
    setActiveSelection(
      nextRow
        ? { zone: "wide", rowId: nextRow.id, blockIndex: 0 }
        : getDefaultSelection(nextLayout),
    );
  }

  function handleAddNarrowRow() {
    if (!layout) {
      return;
    }

    const nextLayout = addDetailLayoutV2NarrowRow(layout);
    const nextRow = nextLayout.mainSplit.narrowRows.at(-1);

    setNotice(null);
    setErrors([]);
    setLayout(nextLayout);
    setActiveSelection(
      nextRow ? { zone: "narrow", rowId: nextRow.id } : getDefaultSelection(nextLayout),
    );
  }

  function handleReset() {
    const nextLayout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);

    setNotice(null);
    setErrors([]);
    setLayout(nextLayout);
    setActiveSelection(getDefaultSelection(nextLayout));
  }

  function putBlockInActiveSelection(type: DetailLayoutBlockType) {
    if (!layout || !activeSelection) {
      setErrors(["เลือกพื้นที่ก่อนเพิ่ม block"]);
      setNotice(null);
      return;
    }

    if (activeSelection.zone === "lockedBottom") {
      setErrors(["บ้านพักแนะนำเป็นส่วนที่ล็อกไว้ ไม่สามารถเพิ่ม block ตรงนี้ได้"]);
      setNotice(null);
      return;
    }

    const block = makeDetailLayoutBlock(type);

    if (activeSelection.zone === "wide") {
      updateLayout((currentLayout) =>
        putDetailLayoutV2WideBlockInSlot(
          currentLayout,
          activeSelection.rowId,
          activeSelection.blockIndex,
          block,
        ),
      );
      return;
    }

    updateLayout((currentLayout) =>
      putDetailLayoutV2NarrowBlock(currentLayout, activeSelection.rowId, block),
    );
  }

  async function handleSave() {
    if (!layout) {
      return;
    }

    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มี layout ที่เปลี่ยนแปลงให้บันทึก");
      return;
    }

    const draftErrors = validateDetailLayoutV2DraftForSave(layout);

    setNotice(null);
    setErrors(draftErrors);

    if (draftErrors.length > 0) {
      return;
    }

    const compactLayout = toDetailLayoutV2Config(layout);
    const validation = validateAnyDetailLayout(compactLayout);

    setNotice(null);
    setErrors(validation.errors);

    if (!validation.ok) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/detail-layout", {
        body: JSON.stringify({ layout: validation.layout }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminDetailLayoutResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.layout) {
        setErrors(extractErrors(payload, "บันทึก layout หน้า Details ไม่ได้"));
        return;
      }

      const nextLayout = toDetailLayoutV2Draft(payload.layout);

      setLayout(nextLayout);
      setSavedSnapshot(makeDetailLayoutV2Snapshot(nextLayout));
      setActiveSelection((currentSelection) =>
        normalizeSelection(nextLayout, currentSelection),
      );
      setNotice("บันทึก layout หน้า Details แล้ว");
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "บันทึก layout หน้า Details ไม่ได้",
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 text-[var(--site-text)]">
      <header className="grid gap-4 border-b border-[var(--site-border)] pb-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--site-primary)]">
            จัดหน้า Details
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--site-text)]">
            Layout รายละเอียดบ้านพัก
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
            จัด block ในพื้นที่ 70/30 ของหน้ารายละเอียดบ้านพัก ส่วนแกลเลอรี ข้อมูลเริ่มต้น
            และบ้านพักแนะนำถูกล็อกไว้เพื่อให้หน้า public คงรูปแบบหลัก
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                hasUnsavedChanges
                  ? "bg-[var(--site-accent-soft)] text-[var(--site-text)] ring-[var(--site-accent)]"
                  : "bg-[var(--site-surface)] text-[var(--site-text)] ring-[var(--site-border)]"
              }`}
            >
              {hasUnsavedChanges ? (
                <CircleAlert aria-hidden="true" className="size-3.5" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
              )}
              {hasUnsavedChanges ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}
            </span>
            <span className="inline-flex min-w-0 items-center rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
              <span className="truncate">ตำแหน่ง: {activePlacementLabel}</span>
            </span>
            {activeBlockTitle ? (
              <span className="inline-flex min-w-0 items-center rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                <span className="truncate">Block: {activeBlockTitle}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={() => {
              handleAddWideRow(1);
            }}
            type="button"
          >
            <PanelTop aria-hidden="true" className="size-4" />
            เพิ่มแถว 70
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={() => {
              handleAddWideRow(2, "50/50");
            }}
            type="button"
          >
            <Columns2 aria-hidden="true" className="size-4" />
            เพิ่มแถว 70 / 2 ช่อง
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={handleAddNarrowRow}
            type="button"
          >
            <Sidebar aria-hidden="true" className="size-4" />
            เพิ่มแถว 30
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            ค่าเริ่มต้น
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || isSaving || !hasUnsavedChanges}
            onClick={() => {
              void handleSave();
            }}
            type="button"
          >
            <Save aria-hidden="true" className="size-4" />
            {isSaving ? "กำลังบันทึก" : "บันทึก"}
          </button>
        </div>
      </header>

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">แก้รายการเหล่านี้ก่อนบันทึก:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {isLoading || !layout ? (
        <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-8 text-center text-sm text-[var(--site-muted)]">
          กำลังโหลด layout หน้า Details...
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(230px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(230px,280px)_minmax(0,1fr)_360px]">
          <div className="xl:sticky xl:top-4 xl:self-start">
            <BlockLibrary
              onAddBlock={putBlockInActiveSelection}
              onDragStart={() => {}}
              targetLabel={activePlacementLabel}
            />
          </div>

          <LayoutCanvas
            activeSelection={activeSelection}
            layout={layout}
            onAddNarrowRow={handleAddNarrowRow}
            onAddWideRow={handleAddWideRow}
            onDropNarrowBlock={(rowId, type) => {
              updateLayout(
                (currentLayout) =>
                  putDetailLayoutV2NarrowBlock(
                    currentLayout,
                    rowId,
                    makeDetailLayoutBlock(type),
                  ),
                { zone: "narrow", rowId },
              );
            }}
            onDropWideBlock={(rowId, blockIndex, type) => {
              updateLayout(
                (currentLayout) =>
                  putDetailLayoutV2WideBlockInSlot(
                    currentLayout,
                    rowId,
                    blockIndex,
                    makeDetailLayoutBlock(type),
                  ),
                { zone: "wide", rowId, blockIndex },
              );
            }}
            onMoveNarrowRow={(fromIndex, toIndex) => {
              updateLayout((currentLayout) =>
                moveDetailLayoutV2NarrowRow(currentLayout, fromIndex, toIndex),
              );
            }}
            onMoveWideBlock={(fromRowId, fromBlockIndex, toRowId, toBlockIndex) => {
              updateLayout(
                (currentLayout) =>
                  moveWideBlock(
                    currentLayout,
                    fromRowId,
                    fromBlockIndex,
                    toRowId,
                    toBlockIndex,
                  ),
                { zone: "wide", rowId: toRowId, blockIndex: toBlockIndex },
              );
            }}
            onMoveWideRow={(fromIndex, toIndex) => {
              updateLayout((currentLayout) =>
                moveDetailLayoutV2WideRow(currentLayout, fromIndex, toIndex),
              );
            }}
            onOuterRatioChange={(ratio) => {
              updateLayout((currentLayout) =>
                updateDetailLayoutV2OuterRatio(currentLayout, ratio),
              );
            }}
            onRemoveNarrowBlock={(rowId) => {
              updateLayout(
                (currentLayout) =>
                  removeDetailLayoutV2NarrowBlock(currentLayout, rowId),
                { zone: "narrow", rowId },
              );
            }}
            onRemoveNarrowRow={(rowId) => {
              updateLayout((currentLayout) =>
                deleteDetailLayoutV2NarrowRow(currentLayout, rowId),
              );
            }}
            onRemoveWideBlock={(rowId, blockIndex) => {
              updateLayout(
                (currentLayout) =>
                  removeDetailLayoutV2WideBlock(currentLayout, rowId, blockIndex),
                { zone: "wide", rowId, blockIndex },
              );
            }}
            onRemoveWideRow={(rowId) => {
              updateLayout((currentLayout) =>
                deleteDetailLayoutV2WideRow(currentLayout, rowId),
              );
            }}
            onSelectLockedBottomBlock={(blockIndex) => {
              setActiveSelection({ zone: "lockedBottom", blockIndex });
            }}
            onSelectNarrowRow={(rowId) => {
              setActiveSelection({ zone: "narrow", rowId });
            }}
            onSelectWideBlock={(rowId, blockIndex) => {
              setActiveSelection({ zone: "wide", rowId, blockIndex });
            }}
            onToggleNarrowRow={(rowId, enabled) => {
              updateLayout((currentLayout) =>
                updateDetailLayoutV2NarrowRow(currentLayout, rowId, { enabled }),
              );
            }}
            onToggleWideRow={(rowId, enabled) => {
              updateLayout((currentLayout) =>
                updateDetailLayoutV2WideRow(currentLayout, rowId, { enabled }),
              );
            }}
            onUpdateWideRow={(rowId, columns, ratio) => {
              updateLayout((currentLayout) =>
                updateDetailLayoutV2WideRowColumns(
                  currentLayout,
                  rowId,
                  columns,
                  ratio,
                ),
              );
            }}
          />

          <aside className="grid content-start gap-3 xl:col-start-2 2xl:sticky 2xl:top-4 2xl:col-start-auto 2xl:self-start">
            <RowSettingsPanel
              layout={layout}
              onRemoveNarrowBlock={(rowId) => {
                updateLayout(
                  (currentLayout) =>
                    removeDetailLayoutV2NarrowBlock(currentLayout, rowId),
                  { zone: "narrow", rowId },
                );
              }}
              onRemoveWideBlock={(rowId, blockIndex) => {
                updateLayout(
                  (currentLayout) =>
                    removeDetailLayoutV2WideBlock(
                      currentLayout,
                      rowId,
                      blockIndex,
                    ),
                  { zone: "wide", rowId, blockIndex },
                );
              }}
              onSelectWideBlock={(rowId, blockIndex) => {
                setActiveSelection({ zone: "wide", rowId, blockIndex });
              }}
              onUpdateNarrowBlock={(rowId, changes) => {
                updateLayout((currentLayout) =>
                  updateDetailLayoutV2NarrowBlock(
                    currentLayout,
                    rowId,
                    changes,
                  ),
                );
              }}
              onUpdateNarrowRow={(rowId, changes) => {
                updateLayout((currentLayout) =>
                  updateDetailLayoutV2NarrowRow(currentLayout, rowId, changes),
                );
              }}
              onUpdateWideBlock={(rowId, blockIndex, changes) => {
                updateLayout((currentLayout) =>
                  updateDetailLayoutV2WideBlock(
                    currentLayout,
                    rowId,
                    blockIndex,
                    changes,
                  ),
                );
              }}
              onUpdateWideRow={(rowId, columns, ratio) => {
                updateLayout((currentLayout) =>
                  updateDetailLayoutV2WideRowColumns(
                    currentLayout,
                    rowId,
                    columns,
                    ratio,
                  ),
                );
              }}
              onUpdateWideRowEnabled={(rowId, enabled) => {
                updateLayout((currentLayout) =>
                  updateDetailLayoutV2WideRow(currentLayout, rowId, { enabled }),
                );
              }}
              selection={activeSelection}
            />
            <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 text-sm shadow-sm">
              <h2 className="font-semibold text-[var(--site-text)]">
                ตัวอย่างย่อ
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
                โครงสร้าง V2 แสดงในผังกลางแล้ว: บนสุดล็อกไว้, พื้นที่หลักแบ่ง
                {layout.mainSplit.ratio}, และบ้านพักแนะนำล็อกเต็มความกว้างด้านล่าง
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
