"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  GripVertical,
  LogOut,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  HomeSectionDraft,
  HomeSectionFallbackMode,
  HomeSectionMode,
} from "@/lib/home-sections/types";
import {
  moveHomeSectionDraft,
  normalizeHouseId,
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import type {
  AdminHomeSectionsResponse,
  AdminManualPreviewResponse,
  AdminSectionDraft,
} from "./types";

const MODES: { label: string; summary: string; value: HomeSectionMode }[] = [
  {
    label: "เลือกบ้านพักเอง",
    summary: "กำหนดเลขบ้านที่อยากแสดง",
    value: "manual",
  },
  {
    label: "บ้านใกล้ทะเลอัตโนมัติ",
    summary: "ให้ระบบเลือกจากบ้านใกล้ทะเล",
    value: "near_sea",
  },
  {
    label: "บ้านตามลำดับจากระบบ",
    summary: "ให้ระบบเลือกจากรายการบ้านทั้งหมด",
    value: "slice",
  },
];

const MODE_LABELS = new Map(MODES.map((mode) => [mode.value, mode.label]));
type StatusTone = "ok" | "warn" | "muted";

type SectionStatusItem = {
  detail: string;
  label: string;
  tone: StatusTone;
};

const SUMMARY_DOT_CLASS: Record<StatusTone, string> = {
  muted: "bg-slate-400",
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
};

const makeDraftId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function normalizeAdminFallbackMode(
  fallbackMode: HomeSectionFallbackMode,
): HomeSectionFallbackMode {
  return fallbackMode === "fill_from_all" ? "fill_from_all" : "none";
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
    ctaLabel: section.ctaLabel,
    ctaHref: section.ctaHref,
    items: section.items.map((item) => ({ houseId: item.houseId })),
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
    .map((houseId) => ({ houseId }));
}

function getManualIdStatus(section: AdminSectionDraft) {
  const duplicateIds: string[] = [];
  const invalidIds: string[] = [];
  const seenIds = new Set<string>();

  section.items.forEach((item) => {
    const normalizedId = normalizeHouseId(item.houseId);

    if (!normalizedId) {
      invalidIds.push(item.houseId);
      return;
    }

    if (seenIds.has(normalizedId)) {
      if (!duplicateIds.includes(normalizedId)) {
        duplicateIds.push(normalizedId);
      }
      return;
    }

    seenIds.add(normalizedId);
  });

  return {
    duplicateIds,
    invalidIds,
    normalizedCount: seenIds.size,
  };
}

function getFallbackModeLabel(value: HomeSectionFallbackMode): string {
  return normalizeAdminFallbackMode(value) === "fill_from_all"
    ? "เติมจากบ้านทั้งหมด"
    : "ไม่เติมบ้านเพิ่ม";
}

function getFallbackSourceText(value: HomeSectionFallbackMode): string {
  return normalizeAdminFallbackMode(value) === "fill_from_all"
    ? "บ้านทั้งหมด"
    : "";
}

function getFallbackExplanation(section: AdminSectionDraft): string {
  const limitLabel = Number.isInteger(section.limitCount)
    ? `${section.limitCount} หลัง`
    : "จำนวนที่ตั้งไว้";
  const baseText =
    section.mode === "manual" ? "บ้านที่เลือก" : "บ้านที่ระบบเลือก";

  if (normalizeAdminFallbackMode(section.fallbackMode) === "none") {
    return `ถ้า${baseText}ไม่ครบ ${limitLabel} ระบบจะแสดงเท่าที่หาได้`;
  }

  return `ถ้า${baseText}ไม่ครบ ${limitLabel} ระบบจะเติมจาก${getFallbackSourceText(
    section.fallbackMode,
  )}`;
}

function getManualDisplaySummary(
  section: AdminSectionDraft,
  selectedCount: number,
  isVerified: boolean,
): string {
  if (!Number.isInteger(section.limitCount) || section.limitCount < 1) {
    return "ตรวจจำนวนบ้านที่แสดงก่อนบันทึก";
  }

  const limitCount = section.limitCount;
  const selectedText = isVerified
    ? "บ้านที่พบในระบบจริง"
    : "เลขบ้านที่อ่านรูปแบบได้";

  if (!isVerified) {
    return `ตอนนี้อ่านรูปแบบได้ ${selectedCount} หลัง ระบบจะตรวจบ้านจริงอีกครั้งตอนบันทึก`;
  }

  if (selectedCount >= limitCount) {
    return `จะแสดง${selectedText} ${limitCount} หลังแรก`;
  }

  const shortageCount = limitCount - selectedCount;

  if (normalizeAdminFallbackMode(section.fallbackMode) === "none") {
    return selectedCount > 0
      ? `จะแสดง${selectedText} ${selectedCount} หลัง และไม่เติมบ้านเพิ่ม`
      : "ยังไม่มีบ้านที่จะแสดง เพราะตั้งไว้ว่าไม่เติมบ้านเพิ่ม";
  }

  const sourceText = getFallbackSourceText(section.fallbackMode);

  return selectedCount > 0
    ? `จะแสดง${selectedText} ${selectedCount} หลัง และเติมอีก ${shortageCount} หลังจาก${sourceText}`
    : `ยังไม่ได้เลือกบ้านเอง ระบบจะเติม ${limitCount} หลังจาก${sourceText}`;
}

function getSectionLabel(section: AdminSectionDraft, sectionIndex: number) {
  return `ชุดที่ ${sectionIndex + 1}${
    section.title.trim() ? ` "${section.title.trim()}"` : ""
  }`;
}

function getPreviewForSection(
  section: AdminSectionDraft,
  sourcePreview: AdminManualPreviewResponse,
): AdminManualPreviewResponse {
  const validById = new Map(sourcePreview.valid.map((villa) => [villa.id, villa]));
  const requestedIds = section.items.reduce<string[]>((ids, item) => {
    const normalizedId = normalizeHouseId(item.houseId);

    if (normalizedId && !ids.includes(normalizedId)) {
      ids.push(normalizedId);
    }

    return ids;
  }, []);

  return {
    valid: requestedIds.flatMap((houseId) => {
      const villa = validById.get(houseId);

      return villa ? [villa] : [];
    }),
    missingIds: requestedIds.filter((houseId) => !validById.has(houseId)),
    invalidIds: section.items
      .map((item) => item.houseId)
      .filter((houseId) => normalizeHouseId(houseId) === null),
  };
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

export function AdminSectionsPage() {
  const router = useRouter();
  const [sections, setSections] = useState<AdminSectionDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
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

  async function fetchManualPreview(token: string, houseIds: string[]) {
    const response = await fetch("/api/admin/home-sections/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ houseIds }),
    });
    const payload = await readJsonPayload(response);

    if (response.status === 401) {
      redirectToLogin();
      return null;
    }

    if (!response.ok) {
      throw new Error(
        extractErrors(payload, "ไม่สามารถตรวจสอบเลขบ้านได้").join("\n"),
      );
    }

    return payload as AdminManualPreviewResponse;
  }

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
            `${sectionLabel} มีเลขบ้านที่ไม่พบในระบบ: ${sectionPreview.missingIds.join(", ")}`,
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
        "ตรวจสอบบ้านพักแล้วพบเลขที่ยังใช้ไม่ได้ แก้รายการเหล่านี้ก่อนบันทึก:",
        ...previewErrors,
      ]);
      return false;
    }

    return true;
  }

  async function handlePreviewManualIds() {
    if (!activeSection) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setErrors([]);
    setNotice(null);
    setIsPreviewing(true);

    try {
      const payload = await fetchManualPreview(
        token,
        activeSection.items.map((item) => item.houseId),
      );

      if (!payload) {
        return;
      }

      setPreview(payload);
      setPreviewDraftId(activeSection.draftId);
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถตรวจสอบเลขบ้านได้",
      ]);
    } finally {
      setIsPreviewing(false);
    }
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

  async function handleLogout() {
    const supabase = createBrowserHomeConfigClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 px-4 py-4 text-[#0f332d] sm:px-6">
      <header className="rounded-[24px] bg-[#064e3b] p-4 text-white shadow-[0_18px_48px_rgba(6,63,53,0.16)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#facc15]">
              หลังบ้านหน้าแรก
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
              จัดชุดบ้านพักหน้าแรก
            </h1>
            <p className="mt-1 text-sm text-emerald-50">
              เลือกและเรียงชุดบ้านพักที่แสดงบนหน้าแรกของเว็บไซต์
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#064e3b] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={addSection}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              เพิ่มชุดบ้านพัก
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#facc15] px-4 text-sm font-semibold text-[#063f35] transition hover:bg-[#fde047] disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70"
              disabled={isSaving || isLoading || !hasUnsavedChanges}
              onClick={handleSave}
              type="button"
            >
              <Save aria-hidden="true" className="size-4" />
              {isSaving
                ? "กำลังตรวจและบันทึก..."
                : hasUnsavedChanges
                  ? "บันทึกหน้าแรก"
                  : "บันทึกแล้ว"}
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={handleLogout}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-white">
            ทั้งหมด {sections.length} ชุด
          </span>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-white">
            เปิดใช้ {activeSectionsCount} ชุด
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              hasUnsavedChanges
                ? "bg-[#fef3c7] text-[#7c4a03]"
                : "bg-white/12 text-white"
            }`}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            {hasUnsavedChanges ? "มีการแก้ไขยังไม่บันทึก" : "บันทึกแล้ว"}
          </span>
        </div>
      </header>

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
        <div className="rounded-md border border-[#c9d9d3] bg-white px-4 py-8 text-center text-sm text-[#506862]">
          กำลังโหลดการจัดหน้าแรก...
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <aside className="rounded-[22px] border border-[#dbe7e3] bg-white p-3 shadow-[0_12px_34px_rgba(6,63,53,0.07)]">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-semibold text-[#063f35]">
                  ลำดับชุดบ้านพัก
                </h2>
                <p className="mt-0.5 text-xs text-[#687d76]">
                  ลากเพื่อเรียงลำดับ หรือใช้ปุ่มลูกศรในชุดที่เลือก
                </p>
              </div>
              <span className="rounded-full bg-[#f4f8f5] px-2.5 py-1 text-xs font-semibold text-[#55746b]">
                {sections.length} ชุด
              </span>
            </div>
            {sections.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#c9d9d3] bg-[#f8fbf7] px-4 py-5 text-sm text-[#506862]">
                ยังไม่มีชุดบ้านพัก กดเพิ่มชุดบ้านพักเพื่อเริ่มจัดหน้าแรก
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((section, sectionIndex) => {
                  const isActive = activeSection?.draftId === section.draftId;
                  const manualCount = section.items.length;

                  return (
                    <button
                      aria-pressed={isActive}
                      className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-[#064e3b] bg-[#f8fbf7] shadow-[0_10px_24px_rgba(6,63,53,0.08)]"
                          : "border-[#dbe7e3] bg-white hover:bg-[#f8fbf7]"
                      }`}
                      draggable
                      key={section.draftId}
                      onClick={() => selectSection(section.draftId)}
                      onDragEnd={() => setDraggedDraftId(null)}
                      onDragOver={handleDragOver}
                      onDragStart={() => handleDragStart(section.draftId)}
                      onDrop={() => handleDrop(section.draftId)}
                      type="button"
                    >
                      <GripVertical
                        aria-hidden="true"
                        className="size-4 text-[#668178]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#123f36]">
                          {sectionIndex + 1}.{" "}
                          {section.title || "ยังไม่ได้ตั้งชื่อ"}
                        </span>
                        <span className="block truncate text-xs text-[#58726a]">
                          {MODE_LABELS.get(section.mode) ?? section.mode}
                          {section.mode === "manual"
                            ? ` / ${manualCount} หลัง`
                            : ""}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          section.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {section.isActive ? "เปิด" : "ปิด"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {activeSection ? (
            <section className="overflow-hidden rounded-[24px] border border-[#dbe7e3] bg-white shadow-[0_12px_34px_rgba(6,63,53,0.07)]">
              <div className="flex flex-col gap-2 border-b border-[#dbe6e1] bg-[#fbfdfb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-normal text-[#687d76]">
                    ชุดที่ {activeIndex + 1}
                  </p>
                  <h2 className="truncate text-lg font-semibold text-[#063f35]">
                    {activeSection.title || "ยังไม่ได้ตั้งชื่อ"}
                  </h2>
                  {deleteNeedsConfirmation ? (
                    <p className="mt-1 text-xs font-semibold text-red-700">
                      กด “ยืนยันลบ” อีกครั้งเพื่อลบชุดนี้
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    aria-label="เลื่อนชุดบ้านพักที่เลือกขึ้น"
                    className="inline-flex size-9 items-center justify-center rounded-md border border-[#b7cbc3] bg-white text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeIndex <= 0}
                    onClick={() => moveSection(activeIndex, activeIndex - 1)}
                    title="เลื่อนขึ้น"
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label="เลื่อนชุดบ้านพักที่เลือกลง"
                    className="inline-flex size-9 items-center justify-center rounded-md border border-[#b7cbc3] bg-white text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeIndex < 0 || activeIndex >= sections.length - 1}
                    onClick={() => moveSection(activeIndex, activeIndex + 1)}
                    title="เลื่อนลง"
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                      deleteNeedsConfirmation
                        ? "border-red-700 bg-red-700 text-white hover:bg-red-800"
                        : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                    }`}
                    onClick={() => requestDeleteSection(activeSection.draftId)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {deleteNeedsConfirmation ? "ยืนยันลบ" : "ลบ"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_320px]">
                <div className="grid gap-4">
                  <div className="grid gap-3">
                    <label className="block text-sm font-medium text-[#173f36]">
                      ชื่อชุดบ้านพัก
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            title: event.target.value,
                          })
                        }
                        placeholder="เช่น บ้านพักแนะนำ"
                        value={activeSection.title}
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#173f36]">
                      คำอธิบาย
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-md border border-[#c9d9d3] bg-white px-3 py-2 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            description: event.target.value,
                          })
                        }
                        placeholder="ข้อความสั้น ๆ ที่แสดงใต้หัวข้อชุดบ้านพัก"
                        value={activeSection.description}
                      />
                    </label>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <fieldset className="min-w-0">
                      <legend className="text-sm font-medium text-[#173f36]">
                        รูปแบบการเลือกบ้าน
                      </legend>
                      <div className="mt-3 grid gap-3">
                        {MODES.map((mode) => {
                          const isSelected = activeSection.mode === mode.value;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={`min-h-20 rounded-xl border px-4 py-4 text-left transition ${
                                isSelected
                                  ? "border-[#2f7cff] bg-[#eef5ff] text-[#0f335f] shadow-[0_0_0_1px_rgba(47,124,255,0.3)]"
                                  : "border-[#dbe1e7] bg-white text-[#55746b] hover:bg-[#f8fbf7]"
                              }`}
                              key={mode.value}
                              onClick={() =>
                                updateSection(activeSection.draftId, {
                                  mode: mode.value,
                                })
                              }
                              type="button"
                            >
                              <span className="block text-sm font-semibold text-[#173f36]">
                                {mode.label}
                              </span>
                              <span className="mt-2 block text-xs leading-5 text-[#52656f]">
                                {mode.summary}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid content-start gap-4">
                      <label className="block text-sm font-medium text-[#173f36]">
                        จำนวนบ้านที่แสดง
                        <input
                          className="mt-3 h-14 w-full rounded-xl border border-[#dbe1e7] bg-white px-4 text-base text-[#173f36] outline-none transition focus:border-[#2f7cff] focus:ring-2 focus:ring-[#2f7cff]/15"
                          min={1}
                          max={12}
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              limitCount: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={activeSection.limitCount}
                        />
                        <span className="mt-2 block text-xs leading-5 text-[#687d76]">
                          แสดงบ้านพักได้ 1-12 หลัง
                        </span>
                      </label>

                      <label className="flex min-h-16 items-center rounded-xl border border-[#dbe1e7] bg-[#fbfcfd] px-4 py-3 text-sm font-semibold text-[#173f36]">
                        <input
                          checked={
                            normalizeAdminFallbackMode(
                              activeSection.fallbackMode,
                            ) === "fill_from_all"
                          }
                          className="size-5 shrink-0 accent-[#075341]"
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              fallbackMode: event.target.checked
                                ? "fill_from_all"
                                : "none",
                            })
                          }
                          type="checkbox"
                        />
                        <span className="ml-3">
                          เติมจากบ้านพักทั้งหมดถ้าไม่ครบ
                        </span>
                      </label>
                      <p className="text-xs leading-5 text-[#687d76]">
                        {getFallbackExplanation(activeSection)}
                      </p>
                    </div>
                  </div>

                  <label className="flex min-h-16 items-center rounded-xl border border-[#dbe1e7] bg-[#fbfcfd] px-5 py-3 text-sm font-semibold text-[#173f36]">
                    <input
                      checked={activeSection.ctaEnabled}
                      className="size-5 shrink-0 accent-[#075341]"
                      onChange={(event) => {
                        const isEnabled = event.target.checked;

                        updateSection(activeSection.draftId, {
                          ctaEnabled: isEnabled,
                          ctaHref:
                            isEnabled && !activeSection.ctaHref.trim()
                              ? "/search"
                              : activeSection.ctaHref,
                          ctaLabel:
                            isEnabled && !activeSection.ctaLabel.trim()
                              ? "ดูเพิ่มเติม"
                              : activeSection.ctaLabel,
                        });
                      }}
                      type="checkbox"
                    />
                    <span className="ml-3">แสดงปุ่มดูเพิ่มเติม</span>
                  </label>

                  <details className="rounded-xl border border-[#dbe1e7] bg-white px-5 py-4 text-sm">
                    <summary className="cursor-pointer font-semibold text-[#173f36]">
                      ตั้งค่าขั้นสูง
                    </summary>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-medium text-[#173f36]">
                        รหัสชุดสำหรับระบบ
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              slug: event.target.value,
                            })
                          }
                          value={activeSection.slug}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#173f36]">
                        เริ่มจากลำดับที่
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                          min={0}
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              sliceOffset: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={activeSection.sliceOffset}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#173f36]">
                        ข้อความบนปุ่มดูเพิ่มเติม
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
                          disabled={!activeSection.ctaEnabled}
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              ctaLabel: event.target.value,
                            })
                          }
                          placeholder="ดูเพิ่มเติม"
                          value={activeSection.ctaLabel}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#173f36]">
                        ลิงก์ปุ่มดูเพิ่มเติม
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
                          disabled={!activeSection.ctaEnabled}
                          onChange={(event) =>
                            updateSection(activeSection.draftId, {
                              ctaHref: event.target.value,
                            })
                          }
                          placeholder="/search"
                          value={activeSection.ctaHref}
                        />
                      </label>
                    </div>
                  </details>

                  {activeSection.mode === "manual" ? null : (
                    <div className="rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
                      <h3 className="text-sm font-semibold text-[#173f36]">
                        {MODE_LABELS.get(activeSection.mode) ??
                          "เลือกบ้านอัตโนมัติ"}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#58726a]">
                        ระบบจะจัดบ้านให้ตามรูปแบบนี้ โดยใช้จำนวนบ้านที่ตั้งไว้ด้านบน
                      </p>
                    </div>
                  )}
                </div>

                <aside className="grid content-start gap-3">
                  {activeSection.mode === "manual" ? (
                    <ManualIdsEditor
                      isPreviewing={isPreviewing}
                      manualIdText={
                        manualIdTexts[activeSection.draftId] ??
                        activeSection.items
                          .map((item) => item.houseId)
                          .join(" ")
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
                      onPreview={handlePreviewManualIds}
                    />
                  ) : null}
                  <SectionOutcomePanel
                    onActiveChange={(isActive) =>
                      updateSection(activeSection.draftId, { isActive })
                    }
                    preview={activePreview}
                    section={activeSection}
                  />
                </aside>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ManualSelectionSummary({
  preview,
  section,
}: {
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
}) {
  const manualStatus = getManualIdStatus(section);
  const rows: SectionStatusItem[] = [];

  if (section.items.length === 0) {
    rows.push({
      detail: "ยังไม่ได้ใส่เลขบ้าน",
      label: "เลขบ้าน",
      tone: "warn",
    });
  } else {
    rows.push({
      detail: `อ่านรูปแบบได้ ${manualStatus.normalizedCount} หลัง ยังไม่ใช่การยืนยันว่ามีบ้านจริง`,
      label: "รูปแบบเลข",
      tone: manualStatus.invalidIds.length > 0 ? "warn" : "ok",
    });
  }

  if (manualStatus.invalidIds.length > 0) {
    rows.push({
      detail: `มีเลขที่อ่านไม่ได้ ${manualStatus.invalidIds.join(", ")}`,
      label: "ต้องแก้",
      tone: "warn",
    });
  }

  if (manualStatus.duplicateIds.length > 0) {
    rows.push({
      detail: `มีเลขซ้ำ ${manualStatus.duplicateIds.join(", ")}`,
      label: "เลขซ้ำ",
      tone: "warn",
    });
  }

  rows.push({
    detail: getManualDisplaySummary(
      section,
      preview ? preview.valid.length : manualStatus.normalizedCount,
      preview !== null,
    ),
    label: "หลังบันทึก",
    tone:
      section.items.length === 0 ||
      manualStatus.invalidIds.length > 0 ||
      (preview !== null &&
        (preview.missingIds.length > 0 || preview.invalidIds.length > 0))
        ? "warn"
        : "ok",
  });

  if (section.items.length > 0) {
    rows.push(
      preview
        ? {
            detail: `ตรวจแล้ว ใช้ได้ ${preview.valid.length} หลัง${
              preview.missingIds.length > 0
                ? ` / ไม่พบ ${preview.missingIds.length}`
                : ""
            }${
              preview.invalidIds.length > 0
                ? ` / รูปแบบไม่ถูกต้อง ${preview.invalidIds.length}`
                : ""
            }`,
            label: "ผลตรวจ",
            tone:
              preview.missingIds.length > 0 || preview.invalidIds.length > 0
                ? "warn"
                : "ok",
          }
        : {
            detail: "ยังไม่ได้ตรวจสอบกับฐานข้อมูลบ้านจริง",
            label: "ผลตรวจ",
            tone: "warn",
          },
    );
  }

  return (
    <div className="border-t border-[#dbe6e1] pt-3">
      <h4 className="text-sm font-semibold text-[#173f36]">
        บ้านพักที่จะบันทึก
      </h4>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {rows.map((row) => (
          <li
            className="grid grid-cols-[auto_84px_1fr] gap-2 text-[#31534a]"
            key={`${row.label}-${row.detail}`}
          >
            <span
              aria-hidden="true"
              className={`mt-2 size-2 rounded-full ${SUMMARY_DOT_CLASS[row.tone]}`}
            />
            <span className="font-semibold text-[#173f36]">{row.label}</span>
            <span className="leading-6">{row.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-5 text-[#58726a]">
        วิธีเติมบ้านเพิ่มตอนนี้: {getFallbackModeLabel(section.fallbackMode)}
      </p>
    </div>
  );
}

function ManualIdsEditor({
  isPreviewing,
  manualIdText,
  onChange,
  onPreview,
}: {
  isPreviewing: boolean;
  manualIdText: string;
  onChange: (value: string) => void;
  onPreview: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#173f36]">
            บ้านพักในชุดนี้
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-[#58726a]">
            พิมพ์เลขบ้านที่ต้องการแสดง เช่น 105 101 111
          </p>
        </div>
        <textarea
          className="min-h-40 w-full rounded-[18px] border border-[#c9d9d3] bg-white px-3 py-2 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder="105 101 111"
          value={manualIdText}
        />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPreviewing}
          onClick={onPreview}
          type="button"
        >
          <Eye aria-hidden="true" className="size-4" />
          {isPreviewing ? "กำลังตรวจสอบ..." : "ตรวจสอบบ้านพัก"}
        </button>
      </div>
    </div>
  );
}

function SectionOutcomePanel({
  onActiveChange,
  preview,
  section,
}: {
  onActiveChange: (isActive: boolean) => void;
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
}) {
  const isManual = section.mode === "manual";

  return (
    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#173f36]">
            ผลลัพธ์ของชุดนี้
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#58726a]">
            ดูบ้านที่จะถูกใช้บนหน้าแรกหลังบันทึก
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#173f36]">
          <input
            checked={section.isActive}
            className="size-4 accent-[#075341]"
            onChange={(event) => onActiveChange(event.target.checked)}
            type="checkbox"
          />
          เปิด
        </label>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e4ece8] pt-3 text-xs">
        <div>
          <dt className="text-[#687d76]">ลำดับ</dt>
          <dd className="font-mono font-semibold text-[#123f36]">
            {section.displayOrder + 1}
          </dd>
        </div>
        <div>
          <dt className="text-[#687d76]">จำนวนที่ตั้งไว้</dt>
          <dd className="font-mono font-semibold text-[#123f36]">
            {section.limitCount} หลัง
          </dd>
        </div>
      </dl>

      {isManual ? (
        <>
          <ManualSelectionSummary preview={preview} section={section} />

          {preview ? (
            <div className="border-t border-[#dbe6e1] pt-3 text-sm">
              <h4 className="font-semibold text-[#173f36]">
                ผลตรวจบ้านจริง
              </h4>
              <p className="mt-1 text-[#506862]">
                พบบ้านพักที่ใช้ได้ {preview.valid.length} หลัง
              </p>

              <PreviewList
                ids={preview.missingIds}
                title="เลขบ้านที่ไม่พบ"
                tone="amber"
              />
              <PreviewList
                ids={preview.invalidIds}
                title="เลขบ้านที่รูปแบบไม่ถูกต้อง"
                tone="red"
              />

              {preview.valid.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-[#e4ece8] pt-3">
                  {preview.valid.slice(0, 8).map((villa) => (
                    <li
                      className="truncate text-xs text-[#31534a]"
                      key={villa.id}
                      title={`บ้านเลขที่ ${villa.id} โซน ${villa.zoneLabel}`}
                    >
                      <span className="font-mono">#{villa.id}</span>{" "}
                      {villa.zoneLabel} / {villa.bedrooms} ห้องนอน / พักได้{" "}
                      {villa.people} คน
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : section.items.length > 0 ? (
            <p className="border-t border-[#dbe6e1] pt-3 text-sm leading-6 text-[#506862]">
              ระบบจะตรวจบ้านจริงให้อัตโนมัติอีกครั้งตอนกดบันทึก
            </p>
          ) : null}

          {section.items.length > 0 ? (
            <div className="border-t border-[#dbe6e1] pt-3">
              <h4 className="text-sm font-semibold text-[#173f36]">
                เลขที่อ่านจากช่องกรอก
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {section.items.map((item, itemIndex) => {
                  const normalizedId = normalizeHouseId(item.houseId);

                  return (
                    <span
                      className={`rounded px-2 py-1 font-mono text-xs ${
                        normalizedId
                          ? "bg-[#eef6f2] text-[#17463c]"
                          : "bg-red-50 text-red-700"
                      }`}
                      key={`${item.houseId}-${itemIndex}`}
                    >
                      {normalizedId ?? item.houseId}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 border-t border-[#dbe6e1] pt-3 text-sm leading-6 text-[#506862]">
          บ้านพักจะถูกเลือกอัตโนมัติเมื่อบันทึกและเปิดหน้าแรก
        </p>
      )}
    </div>
  );
}

function PreviewList({
  ids,
  title,
  tone,
}: {
  ids: string[];
  title: string;
  tone: "amber" | "red";
}) {
  if (ids.length === 0) {
    return null;
  }

  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 break-words font-mono text-xs">{ids.join(", ")}</p>
    </div>
  );
}
