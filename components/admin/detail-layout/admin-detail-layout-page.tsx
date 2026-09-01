"use client";

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Eye,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { validateAnyDetailLayout } from "@/lib/detail-layout/compat";
import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import {
  getAdminErrorMessage,
} from "@/components/admin/admin-error-messages";
import {
  extractAdminErrors as extractErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { useAdminSidebarCollapsed } from "@/components/admin/layout/admin-sidebar-preference";
import { AdminDetailLayoutSkeleton } from "@/components/admin/loading/admin-detail-layout-skeleton";

import { BlockLibrary } from "./block-library";
import {
  GalleryStyleEditor,
  type GalleryStyleEditorHandle,
  type GalleryStyleEditorSaveState,
} from "./gallery-style-editor";
import { DetailLayoutPreview } from "./detail-layout-preview";
import { makeDetailLayoutBlock } from "./detail-layout-helpers";
import {
  addDetailLayoutV2NarrowRow,
  addDetailLayoutV2WideRow,
  deleteDetailLayoutV2NarrowRow,
  deleteDetailLayoutV2WideRow,
  makeDetailLayoutV2Snapshot,
  moveDetailLayoutV2NarrowBlock,
  moveDetailLayoutV2NarrowBlockToWideSlot,
  moveDetailLayoutV2NarrowRow,
  moveDetailLayoutV2WideBlock,
  moveDetailLayoutV2WideBlockToNarrowRow,
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
  validateDetailLayoutV2DraftForSaveDetails,
  type DetailLayoutV2DraftSaveError,
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

const DETAIL_LAYOUT_PREVIEW_HREF = "/villas/2938";

type DesktopSettingsPinPosition = {
  left: number;
  width: number;
};

function splitDetailLayoutErrors(errors: DetailLayoutV2DraftSaveError[]) {
  const errorMessagesByTarget: Record<string, string[]> = {};
  const globalErrors: string[] = [];

  errors.forEach((error) => {
    if (!error.target) {
      globalErrors.push(error.message);
      return;
    }

    errorMessagesByTarget[error.target] = [
      ...(errorMessagesByTarget[error.target] ?? []),
      error.message,
    ];
  });

  return { errorMessagesByTarget, globalErrors };
}

function scrollToFirstDetailLayoutError() {
  window.setTimeout(() => {
    const errorElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-detail-layout-error="true"]'),
    );
    const firstErrorElement = errorElements
      .map((element, index) => ({
        element,
        index,
        top: element.getBoundingClientRect().top + window.scrollY,
      }))
      .sort((left, right) => left.top - right.top || left.index - right.index)[0]
      ?.element;

    firstErrorElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstErrorElement?.focus({ preventScroll: true });
  }, 0);
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

/**
 * Produce a localized label for a wide-row slot based on the row's column count and the block position.
 *
 * @param columns - Number of columns in the wide row (1 or 2)
 * @param blockIndex - Zero-based index of the block within the row
 * @returns The label text: `ช่องเดี่ยว` when `columns` is 1; otherwise `ช่องซ้าย` for `blockIndex === 0` or `ช่องขวา` for other indexes
 */
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
    return "เลือกพื้นที่ก่อน";
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

export function AdminDetailLayoutPage() {
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const router = useRouter();
  const [layout, setLayout] = useState<DetailLayoutV2Draft | null>(null);
  const [activeSelection, setActiveSelection] =
    useState<DetailLayoutCanvasSelection>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorMessagesByTarget, setErrorMessagesByTarget] = useState<
    Record<string, string[]>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isSectionNavigationExpanded, setIsSectionNavigationExpanded] =
    useState(false);
  const [isDesktopSettingsPinned, setIsDesktopSettingsPinned] =
    useState(false);
  const [desktopSettingsPinPosition, setDesktopSettingsPinPosition] =
    useState<DesktopSettingsPinPosition | null>(null);
  const [gallerySaveState, setGallerySaveState] =
    useState<GalleryStyleEditorSaveState>({
      hasUnsavedChanges: false,
      isLoading: true,
      isSaving: false,
    });
  const blockLibraryRef = useRef<HTMLElement | null>(null);
  const galleryEditorRef = useRef<GalleryStyleEditorHandle | null>(null);
  const sidebarRailRef = useRef<HTMLDivElement | null>(null);

  const normalizedActiveSelection = useMemo(
    () => (layout ? normalizeSelection(layout, activeSelection) : null),
    [activeSelection, layout],
  );

  useEffect(() => {
    const blockLibrary = blockLibraryRef.current;

    if (!blockLibrary || typeof IntersectionObserver === "undefined") {
      setIsDesktopSettingsPinned(false);
      return;
    }

    let latestEntry: IntersectionObserverEntry | null = null;

    function updateDesktopSettingsPin(entry: IntersectionObserverEntry | null) {
      const shouldPin = Boolean(
        window.innerWidth >= 1280 &&
          entry &&
          !entry.isIntersecting &&
          entry.boundingClientRect.bottom <= 0,
      );

      if (!shouldPin) {
        setDesktopSettingsPinPosition(null);
        setIsDesktopSettingsPinned(false);
        return;
      }

      const railBounds = sidebarRailRef.current?.getBoundingClientRect();

      setDesktopSettingsPinPosition(
        railBounds && railBounds.width > 0
          ? { left: railBounds.left, width: railBounds.width }
          : null,
      );
      setIsDesktopSettingsPinned(true);
    }

    const observer = new IntersectionObserver((entries) => {
      latestEntry = entries[0] ?? null;
      updateDesktopSettingsPin(latestEntry);
    });
    const handleResize = () => updateDesktopSettingsPin(latestEntry);

    observer.observe(blockLibrary);
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [layout]);
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
  const hasPendingChanges =
    hasUnsavedChanges || gallerySaveState.hasUnsavedChanges;
  const isSavingChanges = isSaving || gallerySaveState.isSaving;
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

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const token = await readAdminAccessToken();

    if (!token) {
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
      setErrorMessagesByTarget({});
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
          return false;
        }

        if (!response.ok || !payload?.layout) {
          setErrorMessagesByTarget({});
          setErrors(extractErrors(payload, "โหลด layout หน้า Details ไม่ได้"));
          return false;
        }

        const nextLayout = toDetailLayoutV2Draft(payload.layout);

        setLayout(nextLayout);
        setSavedSnapshot(makeDetailLayoutV2Snapshot(nextLayout));
        setActiveSelection(getDefaultSelection(nextLayout));
        return true;
      } catch (caughtError) {
        setErrorMessagesByTarget({});
        setErrors([
          getAdminErrorMessage(caughtError, "โหลด layout หน้า Details ไม่ได้"),
        ]);
        return false;
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
          getAdminErrorMessage(caughtError, "เริ่มหน้าจัด layout หน้า Details ไม่ได้"),
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
    setErrorMessagesByTarget({});
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
    setErrorMessagesByTarget({});
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
    setErrorMessagesByTarget({});
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
    setErrorMessagesByTarget({});
    setLayout(nextLayout);
    setActiveSelection(getDefaultSelection(nextLayout));
  }

  function putBlockInActiveSelection(type: DetailLayoutBlockType) {
    if (!layout || !normalizedActiveSelection) {
      setErrorMessagesByTarget({});
      setErrors(["เลือกพื้นที่ก่อนเพิ่ม block"]);
      setNotice(null);
      return;
    }

    if (normalizedActiveSelection.zone === "lockedBottom") {
      setErrorMessagesByTarget({});
      setErrors(["เลือกฝั่ง 70 หรือฝั่ง 30 ก่อนเพิ่ม block"]);
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
    const shouldSaveGallery = gallerySaveState.hasUnsavedChanges;

    if (!hasUnsavedChanges && !shouldSaveGallery) {
      setNotice("ยังไม่มีข้อมูลที่เปลี่ยนแปลงให้บันทึก");
      return;
    }

    if (!hasUnsavedChanges) {
      await galleryEditorRef.current?.save();
      return;
    }

    if (!layout) {
      return;
    }

    const draftErrors = validateDetailLayoutV2DraftForSaveDetails(layout);
    const { errorMessagesByTarget: draftErrorsByTarget, globalErrors } =
      splitDetailLayoutErrors(draftErrors);

    setNotice(null);
    setErrors(globalErrors);
    setErrorMessagesByTarget(draftErrorsByTarget);

    if (draftErrors.length > 0) {
      if (Object.keys(draftErrorsByTarget).length > 0) {
        scrollToFirstDetailLayoutError();
      }
      return;
    }

    const compactLayout = toDetailLayoutV2Config(layout);
    const validation = validateAnyDetailLayout(compactLayout);

    setNotice(null);
    setErrorMessagesByTarget({});
    setErrors(validation.errors);

    if (!validation.ok) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);
    const gallerySavePromise = shouldSaveGallery
      ? galleryEditorRef.current?.save()
      : undefined;

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
        setErrorMessagesByTarget({});
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
      setErrorMessagesByTarget({});
      setErrors([
        getAdminErrorMessage(caughtError, "บันทึก layout หน้า Details ไม่ได้"),
      ]);
    } finally {
      await gallerySavePromise;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-24 text-[var(--site-text)] lg:pb-0">
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--site-border)] bg-[var(--site-background)]/95 px-4 py-3 shadow-[0_-8px_24px_rgb(15_23_42_/_0.12)] backdrop-blur-xl lg:sticky lg:inset-auto lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:border-b lg:border-t-0 lg:bg-[var(--site-background)]/90 lg:px-6 lg:pb-3 lg:pt-4 lg:shadow-none"
        data-detail-layout-page-header="true"
      >
        <header className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Detail Layout
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-[var(--site-text)]">
              จัดหน้า Details
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--site-muted)]">
              จัดลำดับแถว เปิดหรือปิดการแสดงผล และวางบล็อกของหน้ารายละเอียดบ้านพักในมุมมองแบบ
              master-detail-preview
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${
                  hasPendingChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                {hasPendingChanges ? (
                  <CircleAlert aria-hidden="true" className="size-3.5" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5" />
                )}
                {hasPendingChanges ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกล่าสุดแล้ว"}
              </span>
              {layout ? (
                <span className="inline-flex items-center rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                  ตำแหน่งที่เลือก: {activePlacementLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:justify-end">
            <button
              className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] lg:inline-flex"
              disabled={isLoading || isSaving}
              onClick={handleReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              ค่าเริ่มต้น
            </button>
            <a
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] lg:w-auto"
              href={DETAIL_LAYOUT_PREVIEW_HREF}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              ดูหน้าเว็บจริง
            </a>
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none lg:w-auto"
              data-detail-layout-save
              disabled={isLoading || isSavingChanges || !hasPendingChanges}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save aria-hidden="true" className={`size-4 ${isSaving ? "animate-pulse" : ""}`} />
              {isSavingChanges
                ? "กำลังบันทึก..."
                : hasPendingChanges
                  ? "บันทึก"
                  : "บันทึก"}
            </button>
          </div>
        </header>

      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
        notice={notice}
      />

      {isLoading || !layout ? (
        <AdminDetailLayoutSkeleton />
      ) : (
        <div
          className={`grid gap-6 ${
            isDesktopNavCollapsed
              ? "xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_400px]"
              : "xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_360px]"
          }`}
        >
          <div
            className="grid content-start gap-4 xl:self-start"
            data-detail-layout-sidebar-rail="true"
            ref={sidebarRailRef}
          >
            <aside
              aria-label="การตั้งค่าหน้า Details"
              className={`sticky top-[73px] z-20 self-start rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm lg:relative lg:top-auto xl:order-1 ${
                isDesktopSettingsPinned
                  ? "xl:fixed xl:top-32 xl:z-20"
                  : "xl:relative xl:top-auto"
              }`}
              data-detail-layout-section-navigation="true"
              data-detail-layout-section-navigation-pinned={
                isDesktopSettingsPinned ? "true" : "false"
              }
              style={
                isDesktopSettingsPinned && desktopSettingsPinPosition
                  ? {
                      left: desktopSettingsPinPosition.left,
                      width: desktopSettingsPinPosition.width,
                    }
                  : undefined
              }
            >
              <button
                aria-controls="detail-layout-section-navigation"
                aria-expanded={isSectionNavigationExpanded}
                className="flex w-full items-center justify-between gap-3 p-4 text-left lg:hidden"
                onClick={() => setIsSectionNavigationExpanded((current) => !current)}
                type="button"
              >
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--site-text)]">
                  <Settings2
                    aria-hidden="true"
                    className="size-4 text-[var(--site-primary)]"
                  />
                  การตั้งค่าหน้า Details
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition ${
                    isSectionNavigationExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={
                  isSectionNavigationExpanded ? "block" : "hidden lg:block"
                }
              >
                <div className="hidden border-b border-[var(--site-border)] p-4 lg:block">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--site-primary)]">
                    การตั้งค่าหน้า Details
                  </p>
                  <p className="mt-1 text-sm text-[var(--site-muted)]">
                    เลือกส่วนที่ต้องการจัดการ
                  </p>
                </div>

                <nav
                  aria-label="ส่วนการตั้งค่าหน้า Details"
                  className="grid gap-1 p-2"
                  id="detail-layout-section-navigation"
                >
                  <a
                    className="rounded-md px-3 py-2.5 text-[var(--site-text)] transition hover:bg-[var(--site-surface-tint)]"
                    href="#detail-layout-canvas"
                    onClick={() => setIsSectionNavigationExpanded(false)}
                  >
                    <span className="block text-sm font-semibold">
                      ผังหน้า Details
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--site-muted)]">
                      จัดลำดับแถว บล็อก และสัดส่วนหน้ารายละเอียด
                    </span>
                  </a>
                  <a
                    className="rounded-md px-3 py-2.5 text-[var(--site-text)] transition hover:bg-[var(--site-surface-tint)]"
                    href="#gallery-opening-style"
                    onClick={() => setIsSectionNavigationExpanded(false)}
                  >
                    <span className="block text-sm font-semibold">
                      วิธีเปิดดูรูปบ้าน
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--site-muted)]">
                      เลือกรูปแบบและสีของการแสดงรูปบ้าน
                    </span>
                  </a>
                </nav>
              </div>
            </aside>

            <section
              className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm xl:order-2"
              data-detail-layout-block-library="true"
              ref={blockLibraryRef}
            >
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
          </div>

          <main className="grid min-w-0 content-start gap-6">
            <section
              className="scroll-mt-44 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm lg:scroll-mt-40"
              id="detail-layout-canvas"
            >
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
                <div className={isDesktopNavCollapsed ? "" : "mx-auto max-w-5xl"}>
                  <LayoutCanvas
                    activeSelection={normalizedActiveSelection}
                    errorMessagesByTarget={errorMessagesByTarget}
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
                    onMoveNarrowBlock={(fromRowId, toRowId) => {
                      updateLayout(
                        (currentLayout) =>
                          moveDetailLayoutV2NarrowBlock(
                            currentLayout,
                            fromRowId,
                            toRowId,
                          ),
                        { zone: "narrow", rowId: toRowId },
                      );
                    }}
                    onMoveNarrowBlockToWide={(fromRowId, toRowId, toBlockIndex) => {
                      updateLayout(
                        (currentLayout) =>
                          moveDetailLayoutV2NarrowBlockToWideSlot(
                            currentLayout,
                            fromRowId,
                            toRowId,
                            toBlockIndex,
                          ),
                        {
                          zone: "wide",
                          rowId: toRowId,
                          blockIndex: toBlockIndex,
                        },
                      );
                    }}
                    onMoveWideBlock={(fromRowId, fromBlockIndex, toRowId, toBlockIndex) => {
                      updateLayout(
                        (currentLayout) =>
                          moveDetailLayoutV2WideBlock(
                            currentLayout,
                            fromRowId,
                            fromBlockIndex,
                            toRowId,
                            toBlockIndex,
                          ),
                        { zone: "wide", rowId: toRowId, blockIndex: toBlockIndex },
                      );
                    }}
                    onMoveWideBlockToNarrow={(fromRowId, fromBlockIndex, toRowId) => {
                      updateLayout(
                        (currentLayout) =>
                          moveDetailLayoutV2WideBlockToNarrowRow(
                            currentLayout,
                            fromRowId,
                            fromBlockIndex,
                            toRowId,
                          ),
                        { zone: "narrow", rowId: toRowId },
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

            <div className="scroll-mt-44 lg:scroll-mt-40" id="gallery-opening-style">
              <GalleryStyleEditor
                onSaveStateChange={setGallerySaveState}
                ref={galleryEditorRef}
              />
            </div>
          </main>

          <aside
            className="grid content-start gap-4 xl:col-start-2 xl:row-start-2 2xl:sticky 2xl:col-start-3 2xl:row-start-1 2xl:top-32 2xl:self-start"
            data-detail-layout-side-panel="true"
          >
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

          </aside>
        </div>
      )}
    </div>
  );
}
