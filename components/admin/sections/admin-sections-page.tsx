"use client";

import {
  ArrowDown,
  ArrowUp,
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

import type { HomeSectionDraft } from "@/lib/home-sections/types";
import {
  moveHomeSectionDraft,
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import type {
  AdminHomeSectionsResponse,
  AdminManualPreviewResponse,
  AdminSectionDraft,
} from "./types";
import { AdminSectionsHeader } from "./admin-sections-header";
import { ManualIdsEditor } from "./manual-ids-editor";
import { SectionConfigForm } from "./section-config-form";
import { SectionList } from "./section-list";
import { SectionOutcomePanel } from "./section-outcome-panel";
import {
  getPreviewForSection,
  getSectionLabel,
  normalizeAdminFallbackMode,
} from "./section-helpers";

const makeDraftId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
      <AdminSectionsHeader
        activeSectionsCount={activeSectionsCount}
        hasUnsavedChanges={hasUnsavedChanges}
        isLoading={isLoading}
        isSaving={isSaving}
        onAddSection={addSection}
        onLogout={handleLogout}
        onSave={handleSave}
        sectionsCount={sections.length}
      />

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
          <SectionList
            activeDraftId={activeSection?.draftId ?? null}
            onDragEnd={() => setDraggedDraftId(null)}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onSelect={selectSection}
            sections={sections}
          />

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

                  <SectionConfigForm
                    onChange={(changes) =>
                      updateSection(activeSection.draftId, changes)
                    }
                    section={activeSection}
                  />
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
