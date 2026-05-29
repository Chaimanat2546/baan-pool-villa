"use client";

import {
  CheckCircle2,
  CircleAlert,
  Columns2,
  Columns3,
  PanelTop,
  RotateCcw,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_DETAIL_LAYOUT } from "@/lib/detail-layout/defaults";
import type {
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutRatio,
} from "@/lib/detail-layout/types";
import {
  cloneDetailLayout,
  moveDetailLayoutRow,
  validateDetailLayout,
} from "@/lib/detail-layout/validation";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import { BlockLibrary } from "./block-library";
import { DetailLayoutPreview } from "./detail-layout-preview";
import {
  addDetailLayoutRow,
  deleteDetailLayoutRow,
  duplicateDetailLayoutRow,
  getFirstEditableRowId,
  makeDetailLayoutBlock,
  makeDetailLayoutSnapshot,
  putDetailLayoutBlockInSlot,
  removeDetailLayoutBlock,
  updateDetailLayoutBlock,
  updateDetailLayoutRow,
  updateDetailLayoutRowColumns,
} from "./detail-layout-helpers";
import { LayoutCanvas } from "./layout-canvas";
import { RowSettingsPanel } from "./row-settings-panel";
import type {
  AdminDetailLayoutResponse,
  DetailLayoutBlock,
  DetailLayoutRow,
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

function findRow(layout: DetailLayoutConfig | null, rowId: string | null) {
  if (!layout || !rowId) {
    return null;
  }

  return layout.rows.find((row) => row.id === rowId) ?? null;
}

function findBlock(row: DetailLayoutRow | null, blockIndex: number | null) {
  if (!row || blockIndex === null) {
    return undefined;
  }

  return row.blocks[blockIndex];
}

export function AdminDetailLayoutPage() {
  const router = useRouter();
  const [layout, setLayout] = useState<DetailLayoutConfig | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRow = useMemo(
    () => findRow(layout, activeRowId),
    [activeRowId, layout],
  );
  const activeBlock = useMemo(
    () => findBlock(activeRow, activeBlockIndex),
    [activeBlockIndex, activeRow],
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!layout || savedSnapshot === null) {
      return false;
    }

    return makeDetailLayoutSnapshot(layout) !== savedSnapshot;
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

        const nextLayout = cloneDetailLayout(payload.layout);

        setLayout(nextLayout);
        setSavedSnapshot(makeDetailLayoutSnapshot(nextLayout));
        setActiveRowId(getFirstEditableRowId(nextLayout));
        setActiveBlockIndex(0);
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
    updater: (currentLayout: DetailLayoutConfig) => DetailLayoutConfig,
  ) {
    setNotice(null);
    setErrors([]);
    setLayout((currentLayout) =>
      currentLayout ? updater(currentLayout) : currentLayout,
    );
  }

  function handleAddRow(columns: DetailLayoutColumns) {
    updateLayout((currentLayout) => {
      const nextLayout = addDetailLayoutRow(currentLayout, columns);
      const nextRow = nextLayout.rows.at(-1) ?? null;

      setActiveRowId(nextRow?.id ?? null);
      setActiveBlockIndex(null);

      return nextLayout;
    });
  }

  function handleReset() {
    const nextLayout = cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);

    setNotice(null);
    setErrors([]);
    setLayout(nextLayout);
    setActiveRowId(getFirstEditableRowId(nextLayout));
    setActiveBlockIndex(0);
  }

  function putBlockInActiveRow(type: DetailLayoutBlockType) {
    if (!layout || !activeRow) {
      setErrors(["เลือกแถวก่อนเพิ่ม block"]);
      setNotice(null);
      return;
    }

    if (activeRow.blocks.length >= activeRow.columns) {
      setErrors(["แถวนี้เต็มแล้ว เลือกช่องว่างหรือเพิ่มคอลัมน์ก่อน"]);
      setNotice(null);
      return;
    }

    const nextIndex = activeRow.blocks.length;
    updateLayout((currentLayout) =>
      putDetailLayoutBlockInSlot(
        currentLayout,
        activeRow.id,
        nextIndex,
        makeDetailLayoutBlock(type),
      ),
    );
    setActiveBlockIndex(nextIndex);
  }

  function handleDropBlock(
    rowId: string,
    blockIndex: number,
    type: DetailLayoutBlockType,
  ) {
    updateLayout((currentLayout) =>
      putDetailLayoutBlockInSlot(
        currentLayout,
        rowId,
        blockIndex,
        makeDetailLayoutBlock(type),
      ),
    );
    setActiveRowId(rowId);
    setActiveBlockIndex(blockIndex);
  }

  function handleMoveRow(fromIndex: number, toIndex: number) {
    updateLayout((currentLayout) => moveDetailLayoutRow(currentLayout, fromIndex, toIndex));
  }

  function handleDeleteRow(rowId: string) {
    updateLayout((currentLayout) => {
      const rowIndex = currentLayout.rows.findIndex((row) => row.id === rowId);
      const nextLayout = deleteDetailLayoutRow(currentLayout, rowId);
      const nextActiveRow =
        nextLayout.rows[Math.min(rowIndex, nextLayout.rows.length - 1)] ?? null;

      setActiveRowId(nextActiveRow?.id ?? null);
      setActiveBlockIndex(nextActiveRow?.blocks[0] ? 0 : null);

      return nextLayout;
    });
  }

  function handleDuplicateRow(rowId: string) {
    updateLayout((currentLayout) => {
      const nextLayout = duplicateDetailLayoutRow(currentLayout, rowId);
      const rowIndex = currentLayout.rows.findIndex((row) => row.id === rowId);
      const duplicateRow = nextLayout.rows[rowIndex + 1] ?? null;

      setActiveRowId(duplicateRow?.id ?? rowId);
      setActiveBlockIndex(duplicateRow?.blocks[0] ? 0 : null);

      return nextLayout;
    });
  }

  function handleSelectRow(rowId: string) {
    const row = layout?.rows.find((candidate) => candidate.id === rowId) ?? null;

    setActiveRowId(rowId);
    setActiveBlockIndex(row?.blocks[0] ? 0 : null);
  }

  function handleSelectBlock(rowId: string, blockIndex: number) {
    setActiveRowId(rowId);
    setActiveBlockIndex(blockIndex);
  }

  function handleUpdateColumns(
    columns: DetailLayoutColumns,
    ratio?: DetailLayoutRatio,
  ) {
    if (!activeRow) {
      return;
    }

    updateLayout((currentLayout) =>
      updateDetailLayoutRowColumns(currentLayout, activeRow.id, columns, ratio),
    );

    if (activeBlockIndex !== null && activeBlockIndex >= columns) {
      setActiveBlockIndex(columns - 1);
    }
  }

  function handleUpdateRow(
    changes: Partial<Pick<DetailLayoutRow, "enabled" | "ratio">>,
  ) {
    if (!activeRow) {
      return;
    }

    updateLayout((currentLayout) =>
      updateDetailLayoutRow(currentLayout, activeRow.id, changes),
    );
  }

  function handleUpdateBlock(
    blockIndex: number,
    changes: Partial<Omit<DetailLayoutBlock, "type">>,
  ) {
    if (!activeRow) {
      return;
    }

    updateLayout((currentLayout) =>
      updateDetailLayoutBlock(currentLayout, activeRow.id, blockIndex, changes),
    );
  }

  function handleRemoveBlock(rowId: string, blockIndex: number) {
    updateLayout((currentLayout) =>
      removeDetailLayoutBlock(currentLayout, rowId, blockIndex),
    );

    if (activeRowId === rowId && activeBlockIndex === blockIndex) {
      setActiveBlockIndex(null);
    }
  }

  async function handleSave() {
    if (!layout) {
      return;
    }

    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มี layout ที่เปลี่ยนแปลงให้บันทึก");
      return;
    }

    const validation = validateDetailLayout(layout);

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

      const nextLayout = cloneDetailLayout(payload.layout);

      setLayout(nextLayout);
      setSavedSnapshot(makeDetailLayoutSnapshot(nextLayout));
      setActiveRowId((currentRowId) =>
        findRow(nextLayout, currentRowId) ? currentRowId : getFirstEditableRowId(nextLayout),
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
            จัดลำดับ block ที่ใช้กับหน้ารายละเอียดบ้านพักทุกหลัง ส่วนแกลเลอรีและข้อมูลเริ่มต้นด้านบนถูกล็อกไว้
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
            {activeRow ? (
              <span className="inline-flex items-center rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                แถวที่เลือก: {activeRow.columns} คอลัมน์
                {activeRow.ratio ? ` / ${activeRow.ratio}` : ""}
              </span>
            ) : null}
            {activeBlock ? (
              <span className="inline-flex min-w-0 items-center rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                <span className="truncate">Block: {activeBlock.title}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={() => {
              handleAddRow(1);
            }}
            type="button"
          >
            <PanelTop aria-hidden="true" className="size-4" />
            เพิ่ม 1 คอลัมน์
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={() => {
              handleAddRow(2);
            }}
            type="button"
          >
            <Columns2 aria-hidden="true" className="size-4" />
            เพิ่ม 2 คอลัมน์
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-surface-soft)]"
            disabled={isLoading || isSaving}
            onClick={() => {
              handleAddRow(3);
            }}
            type="button"
          >
            <Columns3 aria-hidden="true" className="size-4" />
            เพิ่ม 3 คอลัมน์
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
            <BlockLibrary onAddBlock={putBlockInActiveRow} onDragStart={() => {}} />
          </div>

          <LayoutCanvas
            activeBlockIndex={activeBlockIndex}
            activeRowId={activeRowId}
            layout={layout}
            onDeleteRow={handleDeleteRow}
            onDropBlock={handleDropBlock}
            onDuplicateRow={handleDuplicateRow}
            onMoveRow={handleMoveRow}
            onRemoveBlock={handleRemoveBlock}
            onSelectBlock={handleSelectBlock}
            onSelectRow={handleSelectRow}
            onToggleRowEnabled={(rowId, enabled) => {
              updateLayout((currentLayout) =>
                updateDetailLayoutRow(currentLayout, rowId, { enabled }),
              );
            }}
          />

          <aside className="grid content-start gap-3 xl:col-start-2 2xl:sticky 2xl:top-4 2xl:col-start-auto 2xl:self-start">
            <RowSettingsPanel
              activeBlockIndex={activeBlockIndex}
              onRemoveBlock={(blockIndex) => {
                if (activeRow) {
                  handleRemoveBlock(activeRow.id, blockIndex);
                }
              }}
              onSelectBlock={(blockIndex) => {
                if (activeRow) {
                  handleSelectBlock(activeRow.id, blockIndex);
                }
              }}
              onUpdateBlock={handleUpdateBlock}
              onUpdateColumns={handleUpdateColumns}
              onUpdateRow={handleUpdateRow}
              row={activeRow}
            />
            <DetailLayoutPreview activeRowId={activeRowId} layout={layout} />
          </aside>
        </div>
      )}
    </div>
  );
}
