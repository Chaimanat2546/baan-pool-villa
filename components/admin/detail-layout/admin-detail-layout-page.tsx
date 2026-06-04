"use client";

import {
  CheckCircle2,
  CircleAlert,
  Eye,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { validateAnyDetailLayout } from "@/lib/detail-layout/compat";
import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import { BlockLibrary } from "./block-library";
import { DetailLayoutPreview } from "./detail-layout-preview";
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
const ADMIN_SECONDARY_BUTTON_CLASS =
  "inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-text)] disabled:cursor-not-allowed disabled:opacity-50";
const DETAIL_LAYOUT_PREVIEW_HREF = "/villas/2938";
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
    return "ช่องเดี่ยว";
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

  const normalizedActiveSelection = useMemo(
    () => (layout ? normalizeSelection(layout, activeSelection) : null),
    [activeSelection, layout],
  );
  const activePlacementLabel = useMemo(
    () => getPlacementLabel(layout, normalizedActiveSelection),
    [layout, normalizedActiveSelection],
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!layout || savedSnapshot === null) {
      return false;
    }

    return makeDetailLayoutV2Snapshot(layout) !== savedSnapshot;
  }, [layout, savedSnapshot]);
  const layoutSummary = useMemo(() => {
    if (!layout) {
      return null;
    }

    return {
      disabledRows:
        layout.mainSplit.wideRows.filter((row) => !row.enabled).length +
        layout.mainSplit.narrowRows.filter((row) => !row.enabled).length,
      narrowRows: layout.mainSplit.narrowRows.length,
      wideRows: layout.mainSplit.wideRows.length,
    };
  }, [layout]);
  const usedBlockTypes = useMemo(() => {
    if (!layout) {
      return [];
    }

    return Array.from(
      new Set(
        [
          ...layout.mainSplit.wideRows.flatMap((row) =>
            row.blocks.map((block) => block?.type),
          ),
          ...layout.mainSplit.narrowRows.map((row) => row.block?.type),
          ...layout.lockedBottom.map((block) => block.type),
        ].filter(
          (type): type is DetailLayoutBlockType => typeof type === "string",
        ),
      ),
    );
  }, [layout]);
  const overviewStats = useMemo(() => {
    if (!layoutSummary) {
      return [];
    }

    return [
      {
        label: "ฝั่ง 70",
        tone: "text-[var(--site-text)]",
        value: `${layoutSummary.wideRows} แถว`,
      },
      {
        label: "ฝั่ง 30",
        tone: "text-[var(--site-text)]",
        value: `${layoutSummary.narrowRows} แถว`,
      },
      {
        label: "ปิดไว้",
        tone:
          layoutSummary.disabledRows > 0
            ? "text-amber-700"
            : "text-[var(--site-text)]",
        value: `${layoutSummary.disabledRows} แถว`,
      },
      {
        label: "บล็อกที่ใช้",
        tone: "text-[var(--site-text)]",
        value: `${usedBlockTypes.length} แบบ`,
      },
    ];
  }, [layoutSummary, usedBlockTypes.length]);

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
      nextRow
        ? { zone: "narrow", rowId: nextRow.id }
        : getDefaultSelection(nextLayout),
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
    if (!layout || !normalizedActiveSelection) {
      setErrors(["เลือกพื้นที่ก่อนเพิ่ม block"]);
      setNotice(null);
      return;
    }

    if (normalizedActiveSelection.zone === "lockedBottom") {
      setErrors([
        "บ้านพักแนะนำเป็นส่วนที่ล็อกไว้ ไม่สามารถเพิ่ม block ตรงนี้ได้",
      ]);
      setNotice(null);
      return;
    }

    const block = makeDetailLayoutBlock(type);

    if (normalizedActiveSelection.zone === "wide") {
      updateLayout((currentLayout) =>
        putDetailLayoutV2WideBlockInSlot(
          currentLayout,
          normalizedActiveSelection.rowId,
          normalizedActiveSelection.blockIndex,
          block,
        ),
      );
      return;
    }

    updateLayout((currentLayout) =>
      putDetailLayoutV2NarrowBlock(
        currentLayout,
        normalizedActiveSelection.rowId,
        block,
      ),
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
      await loadLayout(token, false);
      setNotice("บันทึก layout หน้า Details แล้ว");
      router.refresh();
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
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Detail Layout
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดหน้า Details
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
              จัดลำดับแถว เปิดหรือปิดการแสดงผล และวางบล็อกของหน้ารายละเอียดบ้านพักในมุมมองแบบ
              master-detail-preview
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  hasUnsavedChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                {hasUnsavedChanges ? (
                  <CircleAlert aria-hidden="true" className="size-3.5" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5" />
                )}
                {hasUnsavedChanges ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกล่าสุดแล้ว"}
              </span>
              {layout ? (
                <span className="inline-flex items-center rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                  ตำแหน่งที่เลือก: {activePlacementLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className={ADMIN_SECONDARY_BUTTON_CLASS}
              disabled={isLoading || isSaving}
              onClick={handleReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              ค่าเริ่มต้น
            </button>
            <Link
              className={ADMIN_SECONDARY_BUTTON_CLASS}
              href={DETAIL_LAYOUT_PREVIEW_HREF}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              พรีวิวหน้าจริง
            </Link>
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              disabled={isLoading || isSaving || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save aria-hidden="true" className={`size-4 ${isSaving ? "animate-pulse" : ""}`} />
              {isSaving
                ? "กำลังบันทึก..."
                : hasUnsavedChanges
                  ? "บันทึก layout"
                  : "บันทึกแล้ว"}
            </button>
          </div>
        </header>

        {overviewStats.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                  {stat.label}
                </p>
                <p className={`mt-2 text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

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
        <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-8 text-center text-sm text-[var(--site-muted)] shadow-sm">
          กำลังโหลด layout หน้า Details...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_360px]">
          <aside className="grid content-start gap-4 xl:sticky xl:top-36 xl:self-start">
            <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
              <div className="border-b border-[var(--site-border)] pb-3">
                <h2 className="text-base font-semibold text-[var(--site-text)]">
                  คลังบล็อก
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  เลือกบล็อกที่จะวางลงในตำแหน่งที่กำลังแก้ไข
                </p>
              </div>
              <div className="mt-4">
                <BlockLibrary
                  onAddBlock={putBlockInActiveSelection}
                  onDragStart={() => {}}
                  targetLabel={activePlacementLabel}
                  usedBlockTypes={usedBlockTypes}
                />
              </div>
            </section>
          </aside>

          <main className="min-w-0">
            <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--site-border)] px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--site-text)]">
                    ผังหน้า Details
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                    ลากสลับตำแหน่ง เพิ่มแถว และปรับสัดส่วนของแต่ละส่วนได้จากพื้นที่นี้
                  </p>
                </div>
                <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                    ตำแหน่งที่เลือก
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--site-text)]">
                    {activePlacementLabel}
                  </p>
                </div>
              </div>
              <div className="px-3 py-4 sm:px-5 sm:py-6">
                <div className="mx-auto max-w-5xl">
                  <LayoutCanvas
                    activeSelection={normalizedActiveSelection}
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
                          removeDetailLayoutV2WideBlock(
                            currentLayout,
                            rowId,
                            blockIndex,
                          ),
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
                </div>
              </div>
            </section>
          </main>

          <aside className="grid content-start gap-4 2xl:sticky 2xl:top-36 2xl:self-start">
            <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
              <div className="border-b border-[var(--site-border)] px-4 py-4">
                <h2 className="text-base font-semibold text-[var(--site-text)]">
                  ตั้งค่าแถวและบล็อก
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  ปรับรายละเอียดของส่วนที่เลือก รวมถึงการแสดงผลและลำดับการวาง
                </p>
              </div>
              <div className="p-4">
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
                      updateDetailLayoutV2NarrowBlock(currentLayout, rowId, changes),
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
                  selection={normalizedActiveSelection}
                />
              </div>
            </section>

            <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
              <div className="border-b border-[var(--site-border)] px-4 py-4">
                <h2 className="text-base font-semibold text-[var(--site-text)]">
                  พรีวิวย่อ
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  ตรวจดูภาพรวมของหน้า detail พร้อมตำแหน่งที่กำลังแก้ไข
                </p>
              </div>
              <div className="p-4">
                <DetailLayoutPreview
                  activeSelection={normalizedActiveSelection}
                  layout={layout}
                />
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
