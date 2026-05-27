"use client";

import {
  ArrowDown,
  ArrowUp,
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

const MODES: { label: string; value: HomeSectionMode }[] = [
  { label: "Manual IDs", value: "manual" },
  { label: "Near sea", value: "near_sea" },
  { label: "Slice", value: "slice" },
];

const FALLBACK_MODES: { label: string; value: HomeSectionFallbackMode }[] = [
  { label: "None", value: "none" },
  { label: "Fill from all", value: "fill_from_all" },
  { label: "Fill near sea", value: "fill_near_sea" },
];

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
    fallbackMode: section.fallbackMode,
    sliceOffset: section.sliceOffset,
    isActive: section.isActive,
    ctaEnabled: section.ctaEnabled,
    ctaLabel: section.ctaLabel,
    ctaHref: section.ctaHref,
    items: section.items.map((item) => ({ houseId: item.houseId })),
  };
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
    title: "New section",
    description: "Describe this home page section.",
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
          setErrors(extractErrors(payload, "Unable to load home sections."));
          return;
        }

        const mappedSections = mapResponseSections(payload);

        setSections(mappedSections);
        setManualIdTexts({});
        setActiveDraftId(mappedSections[0]?.draftId ?? null);
        setPreview(null);
        setPreviewDraftId(null);
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load home sections.",
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
            : "Unable to initialize admin sections.",
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
    setSections((currentSections) => {
      const nextSection = makeNewSection(currentSections);

      setActiveDraftId(nextSection.draftId);
      return [...currentSections, nextSection];
    });
  }

  function deleteSection(draftId: string) {
    setNotice(null);
    setErrors([]);
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
      const response = await fetch("/api/admin/home-sections/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          houseIds: activeSection.items.map((item) => item.houseId),
        }),
      });

      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        console.error("Unable to preview manual IDs.", {
          payload,
          status: response.status,
        });
        setErrors(extractErrors(payload, "Unable to preview manual IDs."));
        return;
      }

      setPreview(payload as AdminManualPreviewResponse);
      setPreviewDraftId(activeSection.draftId);
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to preview manual IDs.",
      ]);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSave() {
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
        console.error("Unable to save home sections.", {
          payload,
          status: response.status,
        });
        setErrors(extractErrors(payload, "Unable to save home sections."));
        return;
      }

      setNotice("Home sections saved.");
      await loadSections(token, false);
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save home sections.",
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
      <header className="flex flex-col gap-3 border-b border-[#cadbd4] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-[#063f35]">
            Home sections
          </h1>
          <p className="mt-1 text-sm text-[#506862]">
            Arrange and publish the villa rails shown on the home page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={addSection}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add section
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#075341] px-3 text-sm font-semibold text-white transition hover:bg-[#063f35] disabled:cursor-not-allowed disabled:bg-[#89a39b]"
            disabled={isSaving || isLoading}
            onClick={handleSave}
            type="button"
          >
            <Save aria-hidden="true" className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8]"
            onClick={handleLogout}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Logout
          </button>
        </div>
      </header>

      {hasErrors ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">Fix these issues before publishing:</p>
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
          Loading sections...
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <aside className="space-y-2">
            {sections.length === 0 ? (
              <div className="rounded-md border border-[#c9d9d3] bg-white px-4 py-5 text-sm text-[#506862]">
                No sections yet. Add one to begin.
              </div>
            ) : (
              sections.map((section, sectionIndex) => {
                const isActive = activeSection?.draftId === section.draftId;
                const manualCount = section.items.length;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "border-[#0d6b5a] bg-white shadow-sm"
                        : "border-[#c9d9d3] bg-[#f9fbfa] hover:bg-white"
                    }`}
                    draggable
                    key={section.draftId}
                    onClick={() => setActiveDraftId(section.draftId)}
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
                        {sectionIndex + 1}. {section.title || "Untitled"}
                      </span>
                      <span className="block truncate text-xs text-[#58726a]">
                        {section.slug || "missing-slug"} / {section.mode}
                        {section.mode === "manual"
                          ? ` / ${manualCount} IDs`
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
                      {section.isActive ? "On" : "Off"}
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          {activeSection ? (
            <section className="rounded-md border border-[#c9d9d3] bg-white">
              <div className="flex flex-col gap-2 border-b border-[#dbe6e1] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-normal text-[#687d76]">
                    Section {activeIndex + 1}
                  </p>
                  <h2 className="truncate text-lg font-semibold text-[#063f35]">
                    {activeSection.title || "Untitled section"}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    aria-label="Move selected section up"
                    className="inline-flex size-9 items-center justify-center rounded-md border border-[#b7cbc3] bg-white text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeIndex <= 0}
                    onClick={() => moveSection(activeIndex, activeIndex - 1)}
                    title="Move up"
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label="Move selected section down"
                    className="inline-flex size-9 items-center justify-center rounded-md border border-[#b7cbc3] bg-white text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeIndex < 0 || activeIndex >= sections.length - 1}
                    onClick={() => moveSection(activeIndex, activeIndex + 1)}
                    title="Move down"
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    onClick={() => deleteSection(activeSection.draftId)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_320px]">
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[#173f36]">
                      Title
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            title: event.target.value,
                          })
                        }
                        value={activeSection.title}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#173f36]">
                      Slug
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
                  </div>

                  <label className="block text-sm font-medium text-[#173f36]">
                    Description
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-md border border-[#c9d9d3] bg-white px-3 py-2 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                      onChange={(event) =>
                        updateSection(activeSection.draftId, {
                          description: event.target.value,
                        })
                      }
                      value={activeSection.description}
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="block text-sm font-medium text-[#173f36]">
                      Mode
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            mode: event.target.value as HomeSectionMode,
                          })
                        }
                        value={activeSection.mode}
                      >
                        {MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#173f36]">
                      Limit
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
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
                    </label>
                    <label className="block text-sm font-medium text-[#173f36]">
                      Slice offset
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
                      Fallback
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            fallbackMode: event.target
                              .value as HomeSectionFallbackMode,
                          })
                        }
                        value={activeSection.fallbackMode}
                      >
                        {FALLBACK_MODES.map((fallbackMode) => (
                          <option
                            key={fallbackMode.value}
                            value={fallbackMode.value}
                          >
                            {fallbackMode.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 rounded-md border border-[#dbe6e1] bg-[#f8fbf9] p-3 md:grid-cols-[auto_1fr_1fr]">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#173f36]">
                      <input
                        checked={activeSection.ctaEnabled}
                        className="size-4 accent-[#075341]"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            ctaEnabled: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      CTA
                    </label>
                    <input
                      aria-label="CTA label"
                      className="h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
                      disabled={!activeSection.ctaEnabled}
                      onChange={(event) =>
                        updateSection(activeSection.draftId, {
                          ctaLabel: event.target.value,
                        })
                      }
                      placeholder="CTA label"
                      value={activeSection.ctaLabel}
                    />
                    <input
                      aria-label="CTA href"
                      className="h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
                      disabled={!activeSection.ctaEnabled}
                      onChange={(event) =>
                        updateSection(activeSection.draftId, {
                          ctaHref: event.target.value,
                        })
                      }
                      placeholder="/search?nearSea=1"
                      value={activeSection.ctaHref}
                    />
                  </div>

                  <div className="grid gap-3 rounded-md border border-[#dbe6e1] bg-[#f8fbf9] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#173f36]">
                          Manual house IDs
                        </h3>
                        <p className="mt-0.5 text-xs text-[#58726a]">
                          Type IDs separated by spaces, commas, or new lines.
                        </p>
                      </div>
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isPreviewing || activeSection.mode !== "manual"}
                        onClick={handlePreviewManualIds}
                        type="button"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                        {isPreviewing ? "Checking..." : "Preview IDs"}
                      </button>
                    </div>
                    <textarea
                      className="min-h-36 w-full rounded-md border border-[#c9d9d3] bg-white px-3 py-2 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                      disabled={activeSection.mode !== "manual"}
                      onChange={(event) => {
                        const nextManualIdText = event.target.value;

                        setManualIdTexts((currentTexts) => ({
                          ...currentTexts,
                          [activeSection.draftId]: nextManualIdText,
                        }));
                        updateSection(activeSection.draftId, {
                          items: parseManualIds(nextManualIdText),
                        });
                      }}
                      placeholder="105 101 111"
                      value={
                        manualIdTexts[activeSection.draftId] ??
                        activeSection.items.map((item) => item.houseId).join(" ")
                      }
                    />
                  </div>
                </div>

                <aside className="grid content-start gap-3">
                  <div className="rounded-md border border-[#dbe6e1] bg-[#f8fbf9] p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#173f36]">
                      <input
                        checked={activeSection.isActive}
                        className="size-4 accent-[#075341]"
                        onChange={(event) =>
                          updateSection(activeSection.draftId, {
                            isActive: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Active on home page
                    </label>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-[#687d76]">Order</dt>
                        <dd className="font-mono font-semibold text-[#123f36]">
                          {activeSection.displayOrder}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#687d76]">Manual IDs</dt>
                        <dd className="font-mono font-semibold text-[#123f36]">
                          {activeSection.items.length}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {preview && previewDraftId === activeSection.draftId ? (
                    <div className="rounded-md border border-[#dbe6e1] bg-white p-3 text-sm">
                      <h3 className="font-semibold text-[#173f36]">
                        Preview result
                      </h3>
                      <p className="mt-1 text-[#506862]">
                        {preview.valid.length} valid villas found.
                      </p>

                      <PreviewList
                        ids={preview.missingIds}
                        title="Missing IDs"
                        tone="amber"
                      />
                      <PreviewList
                        ids={preview.invalidIds}
                        title="Invalid IDs"
                        tone="red"
                      />

                      {preview.valid.length > 0 ? (
                        <ul className="mt-3 space-y-1 border-t border-[#e4ece8] pt-3">
                          {preview.valid.slice(0, 8).map((villa) => (
                            <li
                              className="truncate text-xs text-[#31534a]"
                              key={villa.id}
                              title={`Villa ${villa.id} in ${villa.zoneLabel}`}
                            >
                              <span className="font-mono">#{villa.id}</span>{" "}
                              {villa.zoneLabel} / {villa.bedrooms} BR /{" "}
                              {villa.people} guests
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-md border border-[#dbe6e1] bg-white p-3 text-sm text-[#506862]">
                      Preview manual IDs to see valid, missing, and invalid
                      entries before saving.
                    </div>
                  )}

                  {activeSection.items.length > 0 ? (
                    <div className="rounded-md border border-[#dbe6e1] bg-white p-3">
                      <h3 className="text-sm font-semibold text-[#173f36]">
                        Normalized IDs
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeSection.items.map((item, itemIndex) => {
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
                </aside>
              </div>
            </section>
          ) : null}
        </div>
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
