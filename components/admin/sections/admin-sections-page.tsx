"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  Layers3,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { HomeSectionDraft } from "@/lib/home-sections/types";
import {
  moveHomeSectionDraft,
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminSectionsSkeleton } from "@/components/admin/loading/admin-sections-skeleton";

import type {
  AdminHomeSectionsResponse,
  AdminManualPreviewResponse,
  AdminSectionDraft,
} from "./types";
import { AutoModeSummary } from "./auto-mode-summary";
import { ManualIdsEditor } from "./manual-ids-editor";
import { SectionConfigForm } from "./section-config-form";
import { SectionHomePreview } from "./section-home-preview";
import { SectionList } from "./section-list";
import {
  getFallbackExplanation,
  getFallbackModeLabel,
  getManualIdStatus,
  getPreviewForSection,
  getSectionLabel,
  MODE_LABELS,
  normalizeAdminFallbackMode,
} from "./section-helpers";

let draftIdFallbackCounter = 0;

function makeDraftId() {
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.randomUUID === "function") {
    return cryptoProvider.randomUUID();
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    cryptoProvider.getRandomValues(values);

    return `draft-${Date.now()}-${Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("")}`;
  }

  draftIdFallbackCounter += 1;
  return `draft-${Date.now()}-${draftIdFallbackCounter}`;
}

function toHomeSectionDraft(section: AdminSectionDraft): HomeSectionDraft {
  return {
    slug: section.slug,
    title: section.title,
    description: section.description,
    mode: section.mode,
    limitCount: section.limitCount,
    fallbackMode: normalizeAdminFallbackMode(section.fallbackMode),
    sliceOffset: section.sliceOffset,
    isActive: section.isActive,
    ctaEnabled: section.ctaEnabled,
    ctaLabel: section.ctaEnabled ? "ดูเพิ่มเติม" : section.ctaLabel,
    ctaHref: section.ctaEnabled ? "/search" : section.ctaHref,
    items: section.items.map((item) => ({
      houseId: item.houseId,
      isActive: item.isActive ?? true,
    })),
  };
}

function makeSectionsSnapshot(sections: AdminSectionDraft[]): string {
  return JSON.stringify(sections.map(toHomeSectionDraft));
}

function normalizeDisplayOrder(sections: AdminSectionDraft[]): AdminSectionDraft[] {
  return sections.map((section, sectionIndex) => ({
    ...section,
    displayOrder: sectionIndex,
  }));
}

function mapResponseSections(
  payload: AdminHomeSectionsResponse,
): AdminSectionDraft[] {
  return normalizeDisplayOrder(
    payload.sections
      .map((section) => ({
        ...section,
        fallbackMode: normalizeAdminFallbackMode(section.fallbackMode),
        draftId: makeDraftId(),
        items: section.items.map((item, itemIndex) => ({
          houseId: item.houseId,
          position: item.position ?? itemIndex,
          isActive: item.isActive ?? true,
        })),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder),
  );
}

function makeNewSection(existingSections: AdminSectionDraft[]): AdminSectionDraft {
  const usedSlugs = new Set(existingSections.map((section) => section.slug));
  let sectionNumber = existingSections.length + 1;
  let slug = `new-section-${sectionNumber}`;

  while (usedSlugs.has(slug)) {
    sectionNumber += 1;
    slug = `new-section-${sectionNumber}`;
  }

  return {
    draftId: makeDraftId(),
    slug,
    title: "ชุดบ้านพักใหม่",
    description: "",
    mode: "manual",
    limitCount: 6,
    fallbackMode: "fill_from_all",
    sliceOffset: 0,
    isActive: true,
    ctaEnabled: false,
    ctaLabel: "",
    ctaHref: "",
    items: [],
    displayOrder: existingSections.length,
  };
}

function parseManualIds(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((houseId) => houseId.trim())
    .filter(Boolean)
    .map((houseId) => ({ houseId, isActive: true }));
}

function extractErrors(payload: unknown, fallback: string): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const errorPayload = payload as {
    code?: unknown;
    details?: unknown;
    error?: unknown;
    errors?: unknown;
    hint?: unknown;
  };

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

/**
 * Renders a titled section block with a short description and arbitrary child content.
 *
 * @param children - Content to render inside the section below the description
 * @param title - Heading text displayed at the top of the section
 * @param description - Supporting text shown beneath the title
 * @returns A section element containing the title, description, and provided children
 */
function SectionEditorGroup({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
      <div>
        <h3 className="text-base font-semibold text-[var(--site-text)]">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function isAbortSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal ? signal.aborted : false;
}

/**
 * Admin interface for managing home-page sections.
 *
 * Provides a full-featured page that loads section drafts, lets administrators add, edit, reorder, delete, validate manual house IDs, and review a prototype-only homepage preview before saving changes back to the server.
 *
 * @returns The React element rendering the admin home-sections management page.
 */
export function AdminSectionsPage() {
  const router = useRouter();
  const [sections, setSections] = useState<AdminSectionDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [, setIsPreviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualIdTexts, setManualIdTexts] = useState<Record<string, string>>({});
  const [pendingDeleteDraftId, setPendingDeleteDraftId] = useState<
    string | null
  >(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminManualPreviewResponse | null>(
    null,
  );
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);

  const activeSection = useMemo(
    () =>
      sections.find((section) => section.draftId === activeDraftId) ??
      sections[0] ??
      null,
    [activeDraftId, sections],
  );
  const activeIndex = activeSection
    ? sections.findIndex((section) => section.draftId === activeSection.draftId)
    : -1;
  const hasErrors = errors.length > 0;
  const currentSnapshot = useMemo(
    () => makeSectionsSnapshot(sections),
    [sections],
  );
  const hasUnsavedChanges =
    savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const activeSectionsCount = useMemo(
    () => sections.filter((section) => section.isActive).length,
    [sections],
  );
  const deleteNeedsConfirmation =
    activeSection !== null && pendingDeleteDraftId === activeSection.draftId;
  const activePreview =
    activeSection !== null && previewDraftId === activeSection.draftId
      ? preview
      : null;
  const activeManualDraftId =
    activeSection?.mode === "manual" ? activeSection.draftId : null;
  const activeManualHouseIdsKey =
    activeSection?.mode === "manual"
      ? activeSection.items.map((item) => item.houseId).join("\n")
      : "";
  const activeModeLabel = activeSection
    ? (MODE_LABELS.get(activeSection.mode) ?? activeSection.mode)
    : null;
  const activeManualStatus =
    activeSection?.mode === "manual"
      ? getManualIdStatus(activeSection)
      : null;
  const duplicateManualIds = activeManualStatus?.duplicateIds.length ?? 0;
  const invalidManualIds = activeManualStatus?.invalidIds.length ?? 0;
  const hasValidatedManualIds =
    activeSection?.mode === "manual" && activePreview !== null;

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

  const loadSections = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);

      try {
        const response = await fetch("/api/admin/home-sections", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401 || response.status === 403) {
          redirectToLogin();
          return;
        }

        const payload = (await response.json()) as AdminHomeSectionsResponse;

        if (!response.ok) {
          setErrors(extractErrors(payload, "ไม่สามารถโหลดการจัดหน้าแรกได้"));
          return;
        }

        const mappedSections = mapResponseSections(payload);

        setSections(mappedSections);
        setSavedSnapshot(makeSectionsSnapshot(mappedSections));
        setManualIdTexts({});
        setActiveDraftId(mappedSections[0]?.draftId ?? null);
        setPreview(null);
        setPreviewDraftId(null);
        setPendingDeleteDraftId(null);
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถโหลดการจัดหน้าแรกได้",
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

        await loadSections(token, true);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถเริ่มต้นหน้าจัดหน้าแรกได้",
        ]);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSections]);

  function updateSection(
    draftId: string,
    changes: Partial<Omit<AdminSectionDraft, "draftId">>,
  ) {
    setNotice(null);
    setErrors([]);
    setPendingDeleteDraftId(null);
    if ("items" in changes || "mode" in changes) {
      setPreview(null);
      setPreviewDraftId(null);
    }
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.draftId === draftId ? { ...section, ...changes } : section,
      ),
    );
  }

  function addSection() {
    setNotice(null);
    setErrors([]);
    setPendingDeleteDraftId(null);
    setSections((currentSections) => {
      const nextSection = makeNewSection(currentSections);

      setActiveDraftId(nextSection.draftId);
      return [...currentSections, nextSection];
    });
  }

  function deleteSection(draftId: string) {
    setNotice(null);
    setErrors([]);
    setPendingDeleteDraftId(null);
    setSections((currentSections) => {
      const nextSections = normalizeDisplayOrder(
        currentSections.filter((section) => section.draftId !== draftId),
      );

      if (activeDraftId === draftId) {
        setActiveDraftId(nextSections[0]?.draftId ?? null);
      }

      return nextSections;
    });
  }

  function moveSection(fromIndex: number, toIndex: number) {
    setNotice(null);
    setErrors([]);
    setPendingDeleteDraftId(null);
    setSections((currentSections) => {
      const activeId = currentSections[activeIndex]?.draftId ?? activeDraftId;
      const movedSections = moveHomeSectionDraft(
        currentSections,
        fromIndex,
        toIndex,
      );

      if (activeId) {
        setActiveDraftId(activeId);
      }

      return movedSections;
    });
  }

  function handleDragStart(draftId: string) {
    setPendingDeleteDraftId(null);
    setDraggedDraftId(draftId);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(targetDraftId: string) {
    if (!draggedDraftId || draggedDraftId === targetDraftId) {
      setDraggedDraftId(null);
      return;
    }

    const fromIndex = sections.findIndex(
      (section) => section.draftId === draggedDraftId,
    );
    const toIndex = sections.findIndex(
      (section) => section.draftId === targetDraftId,
    );

    moveSection(fromIndex, toIndex);
    setDraggedDraftId(null);
  }

  function selectSection(draftId: string) {
    setActiveDraftId(draftId);
    setPendingDeleteDraftId(null);
  }

  function requestDeleteSection(draftId: string) {
    if (pendingDeleteDraftId === draftId) {
      deleteSection(draftId);
      return;
    }

    setNotice(null);
    setErrors([]);
    setPendingDeleteDraftId(draftId);
  }

  const fetchManualPreview = useCallback(
    async (token: string, houseIds: string[], signal?: AbortSignal) => {
      const response = await fetch("/api/admin/home-sections/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ houseIds }),
        signal,
      });
      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return null;
      }

      if (!response.ok) {
        throw new Error(
          extractErrors(payload, "เช็กเลขบ้านไม่ได้").join("\n"),
        );
      }

      return payload as AdminManualPreviewResponse;
    },
    [redirectToLogin],
  );

  const previewManualIds = useCallback(
    async ({
      draftId,
      houseIds,
      showErrors,
      signal,
    }: {
      draftId: string;
      houseIds: string[];
      showErrors: boolean;
      signal?: AbortSignal;
    }) => {
      if (houseIds.length === 0) {
        setPreview(null);
        setPreviewDraftId(null);
        setIsPreviewing(false);
        return;
      }

      const token = await getAccessToken();

      if (!token || isAbortSignalAborted(signal)) {
        return;
      }

      setErrors([]);
      setNotice(null);
      setIsPreviewing(true);

      try {
        const payload = await fetchManualPreview(token, houseIds, signal);

        if (!payload || isAbortSignalAborted(signal)) {
          return;
        }

        setPreview(payload);
        setPreviewDraftId(draftId);
      } catch (caughtError) {
        const isAbortError =
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError";

        if (isAbortError || isAbortSignalAborted(signal) || !showErrors) {
          return;
        }

        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "เช็กเลขบ้านไม่ได้",
        ]);
      } finally {
        if (!isAbortSignalAborted(signal)) {
          setIsPreviewing(false);
        }
      }
    },
    [fetchManualPreview, getAccessToken],
  );

  useEffect(() => {
    if (!activeManualDraftId) {
      return;
    }

    if (!activeManualHouseIdsKey) {
      return;
    }

    const houseIds = activeManualHouseIdsKey.split("\n");
    const controller = new AbortController();
    const previewTimer = window.setTimeout(() => {
      void previewManualIds({
        draftId: activeManualDraftId,
        houseIds,
        showErrors: false,
        signal: controller.signal,
      });
    }, 650);

    return () => {
      window.clearTimeout(previewTimer);
      controller.abort();
    };
  }, [activeManualDraftId, activeManualHouseIdsKey, previewManualIds]);

  async function validateManualSectionsBeforeSave(token: string) {
    const manualSections = sections
      .map((section, sectionIndex) => ({ section, sectionIndex }))
      .filter(
        ({ section }) => section.mode === "manual" && section.items.length > 0,
      );

    if (manualSections.length === 0) {
      return true;
    }

    const combinedPreview = await fetchManualPreview(
      token,
      manualSections.flatMap(({ section }) =>
        section.items.map((item) => item.houseId),
      ),
    );

    if (!combinedPreview) {
      return false;
    }

    const previewErrors: string[] = [];
    const firstProblem = manualSections
      .map(({ section, sectionIndex }) => {
        const sectionPreview = getPreviewForSection(section, combinedPreview);
        const issueCount =
          sectionPreview.missingIds.length + sectionPreview.invalidIds.length;

        if (issueCount === 0) {
          return null;
        }

        const sectionLabel = getSectionLabel(section, sectionIndex);

        if (sectionPreview.missingIds.length > 0) {
          previewErrors.push(
            `${sectionLabel} มีเลขบ้านที่ไม่พบในรายการบ้าน: ${sectionPreview.missingIds.join(", ")}`,
          );
        }

        if (sectionPreview.invalidIds.length > 0) {
          previewErrors.push(
            `${sectionLabel} มีเลขบ้านที่รูปแบบไม่ถูกต้อง: ${sectionPreview.invalidIds.join(", ")}`,
          );
        }

        return { section, sectionPreview };
      })
      .find((result) => result !== null);

    const activeManualSection =
      activeSection?.mode === "manual" && activeSection.items.length > 0
        ? activeSection
        : null;
    const previewSection = firstProblem?.section ?? activeManualSection;

    if (previewSection) {
      setPreview(getPreviewForSection(previewSection, combinedPreview));
      setPreviewDraftId(previewSection.draftId);
    }

    if (firstProblem) {
      setActiveDraftId(firstProblem.section.draftId);
    }

    if (previewErrors.length > 0) {
      setErrors([
        "เช็กบ้านแล้วพบเลขที่ยังใช้ไม่ได้ แก้รายการเหล่านี้ก่อนบันทึก:",
        ...previewErrors,
      ]);
      return false;
    }

    return true;
  }

  async function handleSave() {
    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีรายการที่เปลี่ยนใหม่");
      return;
    }

    const sectionDrafts = sections.map(toHomeSectionDraft);
    const validationErrors = validateHomeSectionDrafts(sectionDrafts);

    setNotice(null);
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);

    try {
      const manualSectionsAreReady =
        await validateManualSectionsBeforeSave(token);

      if (!manualSectionsAreReady) {
        return;
      }

      const response = await fetch("/api/admin/home-sections", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sections: sectionDrafts }),
      });
      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        console.error("ไม่สามารถบันทึกการจัดหน้าแรกได้", {
          payload,
          status: response.status,
        });
        setErrors(extractErrors(payload, "ไม่สามารถบันทึกการจัดหน้าแรกได้"));
        return;
      }

      setNotice("บันทึกการจัดหน้าแรกแล้ว");
      await loadSections(token, false);
      router.refresh();
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถบันทึกการจัดหน้าแรกได้",
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="adminSectionsPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              หน้าแรก
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดชุดบ้านพักหน้าแรก
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
              จัดลำดับแต่ละชุด กำหนดวิธีคัดบ้าน และเช็กภาพรวมก่อนบันทึกให้หน้าแรกแสดงผลตามที่ต้องการ
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
                ทั้งหมด {sections.length} ชุด
              </span>
              <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
                เปิดใช้งาน {activeSectionsCount} ชุด
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  hasUnsavedChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                {hasUnsavedChanges
                  ? "มีรายการที่ยังไม่บันทึก"
                  : "บันทึกล่าสุดแล้ว"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              onClick={addSection}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              เพิ่มชุดบ้านพัก
            </button>
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href="/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              ดูหน้าแรก
            </Link>
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              disabled={isSaving || isLoading || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save
                aria-hidden="true"
                className={`size-4 ${isSaving ? "animate-pulse" : ""}`}
              />
              {isSaving ? "กำลังตรวจและบันทึก..." : "บันทึกหน้าแรก"}
            </button>
          </div>
        </header>
      </div>

      {hasErrors ? (
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

      {isLoading ? (
        <AdminSectionsSkeleton />
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_360px]">
          <aside className="grid content-start gap-3 xl:sticky xl:top-24 xl:self-start">
            <div className="px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                Master
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--site-text)]">
                รายการชุดบนหน้าแรก
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                เลือกชุดที่ต้องการแก้ไข หรือลากเพื่อเปลี่ยนลำดับการแสดงผล
              </p>
            </div>
            <SectionList
              activeDraftId={activeSection?.draftId ?? null}
              onDragEnd={() => setDraggedDraftId(null)}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onSelect={selectSection}
              sections={sections}
            />
          </aside>

          {activeSection ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
                <div className="border-b border-[var(--site-border)] bg-[var(--site-surface-soft)]/80 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
                        Detail
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          ชุดที่ {activeIndex + 1}
                        </span>
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          {activeModeLabel}
                        </span>
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          {activeSection.limitCount.toLocaleString("th-TH")} หลัง
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold text-[var(--site-text)]">
                        {activeSection.title || "ยังไม่ได้ตั้งชื่อชุด"}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
                        ปรับข้อความ วิธีคัดบ้าน และสถานะการแสดงผลของชุดนี้ก่อนบันทึกขึ้นหน้าแรก
                      </p>
                      {deleteNeedsConfirmation ? (
                        <p className="mt-3 text-sm font-semibold text-red-700">
                          กด &quot;ยืนยันลบ&quot; อีกครั้งเพื่อลบชุดนี้
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <label className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] shadow-sm">
                        <input
                          checked={activeSection.isActive}
                          className="size-4 accent-[var(--site-primary)]"
                          onChange={(event) => {
                            updateSection(activeSection.draftId, {
                              isActive: event.target.checked,
                            });
                          }}
                          type="checkbox"
                        />
                        แสดงบนหน้าแรก
                      </label>
                      <button
                        aria-label="เลื่อนชุดบ้านพักที่เลือกขึ้น"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={activeIndex <= 0}
                        onClick={() => {
                          moveSection(activeIndex, activeIndex - 1);
                        }}
                        title="เลื่อนขึ้น"
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="เลื่อนชุดบ้านพักที่เลือกลง"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          activeIndex < 0 || activeIndex >= sections.length - 1
                        }
                        onClick={() => {
                          moveSection(activeIndex, activeIndex + 1);
                        }}
                        title="เลื่อนลง"
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold shadow-sm transition ${
                          deleteNeedsConfirmation
                            ? "border-red-700 bg-red-700 text-white hover:bg-red-800"
                            : "border-red-200 bg-[var(--site-surface)] text-red-700 hover:bg-red-50"
                        }`}
                        onClick={() => {
                          requestDeleteSection(activeSection.draftId);
                        }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        {deleteNeedsConfirmation ? "ยืนยันลบ" : "ลบชุดนี้"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 px-4 py-4 sm:px-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                        สถานะ
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--site-text)]">
                        {activeSection.isActive ? "พร้อมแสดงผล" : "ปิดการแสดงผล"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--site-muted)]">
                        {activeSection.isActive
                          ? "ชุดนี้จะถูกนำไปแสดงตามลำดับที่ตั้งไว้"
                          : "เก็บร่างไว้ก่อน ยังไม่ขึ้นบนหน้าแรก"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                        วิธีคัดบ้าน
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--site-text)]">
                        {activeModeLabel}
                      </p>
                      <p className="mt-1 text-sm text-[var(--site-muted)]">
                        {getFallbackExplanation(activeSection)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                        ปุ่มลิงก์
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--site-text)]">
                        {activeSection.ctaEnabled ? "เปิดใช้งาน" : "ไม่แสดงปุ่ม"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--site-muted)]">
                        {activeSection.ctaEnabled
                          ? activeSection.ctaLabel.trim() || "ดูเพิ่มเติม"
                          : "หน้าแรกจะแสดงเฉพาะรายการบ้านในชุดนี้"}
                      </p>
                    </div>
                  </div>

                  <SectionEditorGroup
                    description="ข้อความส่วนนี้คือหัวข้อและคำโปรยที่ลูกค้าเห็นบนหน้าแรก"
                    title="รายละเอียดชุดบ้านพัก"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-medium text-[var(--site-text)]">
                        ชื่อชุดบ้านพัก
                        <input
                          className="mt-1 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                          onChange={(event) => {
                            updateSection(activeSection.draftId, {
                              title: event.target.value,
                            });
                          }}
                          placeholder="เช่น บ้านพักแนะนำ"
                          value={activeSection.title}
                        />
                      </label>

                      <label className="block text-sm font-medium text-[var(--site-text)] md:row-span-2">
                        คำอธิบาย
                        <textarea
                          className="mt-1 min-h-28 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                          onChange={(event) => {
                            updateSection(activeSection.draftId, {
                              description: event.target.value,
                            });
                          }}
                          placeholder="ข้อความสั้น ๆ ที่แสดงใต้หัวข้อชุดบ้านพัก"
                          value={activeSection.description}
                        />
                      </label>
                    </div>
                  </SectionEditorGroup>

                  <SectionEditorGroup
                    description="กำหนดว่าจะให้ระบบเลือกบ้านแบบไหน จำนวนกี่หลัง และจะเติมบ้านเพิ่มหรือไม่"
                    title="วิธีเลือกและจำนวนบ้าน"
                  >
                    <SectionConfigForm
                      onChange={(changes) => {
                        updateSection(activeSection.draftId, changes);
                      }}
                      section={activeSection}
                    />
                  </SectionEditorGroup>

                  <SectionEditorGroup
                    description={
                      activeSection.mode === "manual"
                        ? "ใส่เลขบ้านตามลำดับที่อยากให้ขึ้น แล้วเช็กก่อนบันทึก"
                        : "ชุดนี้ใช้กติกาอัตโนมัติ จึงไม่ต้องพิมพ์เลขบ้านเอง"
                    }
                    title={
                      activeSection.mode === "manual"
                        ? "เลือกบ้านเอง"
                        : "แหล่งบ้านที่ระบบจะคัดให้"
                    }
                  >
                    {activeSection.mode === "manual" ? (
                      <ManualIdsEditor
                        manualIdText={
                          manualIdTexts[activeSection.draftId] ??
                          activeSection.items
                            .map((item) => item.houseId)
                            .join(",")
                        }
                        onChange={(nextManualIdText) => {
                          setManualIdTexts((currentTexts) => ({
                            ...currentTexts,
                            [activeSection.draftId]: nextManualIdText,
                          }));
                          updateSection(activeSection.draftId, {
                            items: parseManualIds(nextManualIdText),
                          });
                        }}
                      />
                    ) : (
                      <AutoModeSummary mode={activeSection.mode} />
                    )}
                  </SectionEditorGroup>
                </div>
              </section>

              <aside className="grid content-start gap-4 xl:col-start-2 2xl:sticky 2xl:top-24 2xl:col-start-auto 2xl:self-start">
                <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
                        Prototype
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--site-text)]">
                        สรุปก่อนบันทึก
                      </h3>
                    </div>
                    <Layers3
                      aria-hidden="true"
                      className="size-5 text-[var(--site-primary)]"
                    />
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                      <dt className="text-[var(--site-muted)]">ลำดับแสดงผล</dt>
                      <dd className="text-right font-semibold text-[var(--site-text)]">
                        ชุดที่ {activeIndex + 1}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                      <dt className="text-[var(--site-muted)]">รูปแบบการคัด</dt>
                      <dd className="text-right font-semibold text-[var(--site-text)]">
                        {activeModeLabel}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                      <dt className="text-[var(--site-muted)]">จำนวนที่ตั้งไว้</dt>
                      <dd className="text-right font-semibold text-[var(--site-text)]">
                        {activeSection.limitCount.toLocaleString("th-TH")} หลัง
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                      <dt className="text-[var(--site-muted)]">การเติมรายการ</dt>
                      <dd className="max-w-[14rem] text-right font-semibold text-[var(--site-text)]">
                        {getFallbackModeLabel(activeSection.fallbackMode)}
                      </dd>
                    </div>
                    {activeSection.mode === "manual" ? (
                      <>
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                          <dt className="text-[var(--site-muted)]">เลขบ้านที่กรอก</dt>
                          <dd className="text-right font-semibold text-[var(--site-text)]">
                            {activeSection.items.length.toLocaleString("th-TH")} รายการ
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] pb-3">
                          <dt className="text-[var(--site-muted)]">เลขซ้ำ / ไม่ถูกต้อง</dt>
                          <dd className="text-right font-semibold text-[var(--site-text)]">
                            {duplicateManualIds.toLocaleString("th-TH")} /{" "}
                            {invalidManualIds.toLocaleString("th-TH")}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-[var(--site-muted)]">สถานะเลขบ้าน</dt>
                          <dd className="text-right font-semibold text-[var(--site-text)]">
                            {hasValidatedManualIds ? "ตรวจเลขบ้านแล้ว" : "รอตรวจเลขบ้าน"}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-[var(--site-muted)]">เลื่อนรายการเริ่มที่</dt>
                        <dd className="text-right font-semibold text-[var(--site-text)]">
                          {activeSection.sliceOffset.toLocaleString("th-TH")}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                <SectionHomePreview
                  preview={activePreview}
                  section={activeSection}
                />
              </aside>
            </>
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-10 text-center xl:col-span-2">
              <div className="max-w-md">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                  <Layers3 aria-hidden="true" className="size-6" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[var(--site-text)]">
                  ยังไม่มีชุดบ้านพัก
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  เริ่มจากเพิ่มชุดบ้านพักชุดแรก แล้วค่อยกำหนดข้อความ รูปแบบคัดบ้าน และพรีวิวก่อนบันทึก
                </p>
                <button
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)]"
                  onClick={addSection}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  เพิ่มชุดบ้านพัก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
