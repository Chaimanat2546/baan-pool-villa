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
import { isNearSeaVilla } from "@/lib/villas/filters";
import type { VillaListing } from "@/lib/villas/types";
import { VillaCard } from "@/components/villas/listing/villa-card";

import type {
  AdminHomeSectionsResponse,
  AdminManualPreviewResponse,
  AdminSectionDraft,
} from "./types";

type HousesResponse = {
  items?: unknown;
};

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

const FALLBACK_MODES: { label: string; value: HomeSectionFallbackMode }[] = [
  { label: "ไม่เติมบ้านเพิ่ม", value: "none" },
  { label: "เติมจากบ้านทั้งหมด", value: "fill_from_all" },
  { label: "เติมจากบ้านใกล้ทะเล", value: "fill_near_sea" },
];

const MODE_LABELS = new Map(MODES.map((mode) => [mode.value, mode.label]));
type StatusTone = "ok" | "warn" | "muted";

type SectionStatusItem = {
  detail: string;
  label: string;
  tone: StatusTone;
};

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
};

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

function isVillaListing(value: unknown): value is VillaListing {
  if (!value || typeof value !== "object") {
    return false;
  }

  const villa = value as Partial<VillaListing>;

  return (
    typeof villa.id === "string" &&
    typeof villa.zoneLabel === "string" &&
    typeof villa.bedrooms === "number" &&
    typeof villa.people === "number" &&
    typeof villa.price === "number"
  );
}

function getPreviewLimit(section: AdminSectionDraft): number {
  if (!Number.isFinite(section.limitCount)) {
    return 1;
  }

  return Math.min(12, Math.max(1, Math.trunc(section.limitCount)));
}

function appendPreviewFallbackVillas(
  selectedVillas: VillaListing[],
  fallbackVillas: VillaListing[],
  limitCount: number,
): VillaListing[] {
  if (selectedVillas.length >= limitCount) {
    return selectedVillas.slice(0, limitCount);
  }

  const selectedIds = new Set(selectedVillas.map((villa) => villa.id));
  const resolvedVillas = [...selectedVillas];

  for (const villa of fallbackVillas) {
    if (resolvedVillas.length >= limitCount) {
      break;
    }

    if (selectedIds.has(villa.id)) {
      continue;
    }

    selectedIds.add(villa.id);
    resolvedVillas.push(villa);
  }

  return resolvedVillas;
}

function resolvePreviewVillas(
  section: AdminSectionDraft,
  villas: VillaListing[],
): VillaListing[] {
  if (villas.length === 0) {
    return [];
  }

  const limitCount = getPreviewLimit(section);
  const villasById = new Map(villas.map((villa) => [villa.id, villa]));
  let selectedVillas: VillaListing[] = [];

  switch (section.mode) {
    case "manual": {
      const selectedIds = new Set<string>();

      section.items.forEach((item) => {
        const normalizedId = normalizeHouseId(item.houseId);

        if (!normalizedId || selectedIds.has(normalizedId)) {
          return;
        }

        const villa = villasById.get(normalizedId);

        if (!villa) {
          return;
        }

        selectedIds.add(normalizedId);
        selectedVillas.push(villa);
      });
      break;
    }
    case "near_sea":
      selectedVillas = villas.filter(isNearSeaVilla);
      break;
    case "slice":
      selectedVillas = villas.slice(Math.max(0, section.sliceOffset));
      break;
  }

  selectedVillas = selectedVillas.slice(0, limitCount);

  switch (section.fallbackMode) {
    case "fill_from_all":
      return appendPreviewFallbackVillas(selectedVillas, villas, limitCount);
    case "fill_near_sea":
      return appendPreviewFallbackVillas(
        selectedVillas,
        villas.filter(isNearSeaVilla),
        limitCount,
      );
    case "none":
      return selectedVillas;
  }
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

function isAdminInternalHref(value: string): boolean {
  const href = value.trim();

  return href.startsWith("/") && !href.startsWith("//");
}

function getSectionStatusItems(
  section: AdminSectionDraft,
  hasFreshPreview: boolean,
): SectionStatusItem[] {
  const items: SectionStatusItem[] = [
    section.title.trim()
      ? {
          detail: "พร้อมแสดงบนหน้าแรก",
          label: "ชื่อชุด",
          tone: "ok",
        }
      : {
          detail: "ยังไม่ได้กรอกชื่อ",
          label: "ชื่อชุด",
          tone: "warn",
        },
    section.description.trim()
      ? {
          detail: "มีข้อความใต้หัวข้อแล้ว",
          label: "คำอธิบาย",
          tone: "ok",
        }
      : {
          detail: "ยังไม่ได้กรอกคำอธิบาย",
          label: "คำอธิบาย",
          tone: "warn",
        },
    section.isActive
      ? {
          detail: "เปิดอยู่บนหน้าแรก",
          label: "การแสดงผล",
          tone: "ok",
        }
      : {
          detail: "ปิดอยู่และจะไม่แสดง",
          label: "การแสดงผล",
          tone: "muted",
        },
  ];

  if (
    !Number.isInteger(section.limitCount) ||
    section.limitCount < 1 ||
    section.limitCount > 12
  ) {
    items.push({
      detail: "ต้องอยู่ระหว่าง 1 ถึง 12",
      label: "จำนวนบ้าน",
      tone: "warn",
    });
  }

  if (section.ctaEnabled) {
    items.push(
      section.ctaLabel.trim() && isAdminInternalHref(section.ctaHref)
        ? {
            detail: "ปุ่มดูเพิ่มเติมพร้อมใช้งาน",
            label: "ปุ่มดูเพิ่มเติม",
            tone: "ok",
          }
        : {
            detail: "ยังขาดข้อความหรือลิงก์",
            label: "ปุ่มดูเพิ่มเติม",
            tone: "warn",
          },
    );
  }

  if (section.mode !== "manual") {
    items.push({
      detail: MODE_LABELS.get(section.mode) ?? "ระบบเลือกบ้านให้",
      label: "บ้านพัก",
      tone: "ok",
    });
    return items;
  }

  const manualStatus = getManualIdStatus(section);

  if (section.items.length === 0) {
    items.push({
      detail: "ยังไม่ได้ใส่เลขบ้าน",
      label: "เลขบ้าน",
      tone: "warn",
    });
  } else if (manualStatus.invalidIds.length > 0) {
    items.push({
      detail: `อ่านไม่ได้ ${manualStatus.invalidIds.length} รายการ`,
      label: "เลขบ้าน",
      tone: "warn",
    });
  } else {
    items.push({
      detail: `อ่านได้ ${manualStatus.normalizedCount} หลัง`,
      label: "เลขบ้าน",
      tone: "ok",
    });
  }

  if (manualStatus.duplicateIds.length > 0) {
    items.push({
      detail: `มีเลขซ้ำ ${manualStatus.duplicateIds.join(", ")}`,
      label: "เลขซ้ำ",
      tone: "warn",
    });
  }

  if (section.items.length > 0) {
    items.push(
      hasFreshPreview
        ? {
            detail: "ตรวจสอบกับระบบแล้ว",
            label: "ผลตรวจสอบ",
            tone: "ok",
          }
        : {
            detail: "ยังไม่ได้กดตรวจสอบบ้านพัก",
            label: "ผลตรวจสอบ",
            tone: "warn",
          },
    );
  }

  return items;
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
  const [isLoadingVillaPreview, setIsLoadingVillaPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [villaPreviewError, setVillaPreviewError] = useState<string | null>(
    null,
  );
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
  const [villaListings, setVillaListings] = useState<VillaListing[]>([]);

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
  const activeStatusItems = useMemo(
    () =>
      activeSection
        ? getSectionStatusItems(
            activeSection,
            previewDraftId === activeSection.draftId,
          )
        : [],
    [activeSection, previewDraftId],
  );
  const activePreviewVillas = useMemo(
    () =>
      activeSection
        ? resolvePreviewVillas(activeSection, villaListings)
        : [],
    [activeSection, villaListings],
  );

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

  useEffect(() => {
    let isMounted = true;

    async function loadVillaListings() {
      setIsLoadingVillaPreview(true);
      setVillaPreviewError(null);

      try {
        const response = await fetch("/api/houses");

        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดตัวอย่างบ้านพักได้");
        }

        const payload = (await response.json()) as HousesResponse;
        const items = Array.isArray(payload.items)
          ? payload.items.filter(isVillaListing)
          : [];

        if (!isMounted) {
          return;
        }

        setVillaListings(items);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setVillaPreviewError(
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถโหลดตัวอย่างบ้านพักได้",
        );
      } finally {
        if (isMounted) {
          setIsLoadingVillaPreview(false);
        }
      }
    }

    void loadVillaListings();

    return () => {
      isMounted = false;
    };
  }, []);

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
        console.error("ไม่สามารถตรวจสอบเลขบ้านได้", {
          payload,
          status: response.status,
        });
        setErrors(extractErrors(payload, "ไม่สามารถตรวจสอบเลขบ้านได้"));
        return;
      }

      setPreview(payload as AdminManualPreviewResponse);
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
                ? "กำลังบันทึก..."
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
            {hasUnsavedChanges ? "มีการแก้ไขยังไม่บันทึก" : "ข้อมูลล่าสุดแล้ว"}
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
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <aside className="rounded-[22px] border border-[#dbe7e3] bg-white p-3 shadow-[0_12px_34px_rgba(6,63,53,0.07)]">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold text-[#063f35]">
                ลำดับชุดบ้านพัก
              </h2>
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

              <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-w-0 gap-4">
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

                  <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
                    <fieldset className="min-w-0">
                      <legend className="text-sm font-medium text-[#173f36]">
                        รูปแบบการเลือกบ้าน
                      </legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {MODES.map((mode) => {
                          const isSelected = activeSection.mode === mode.value;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={`min-h-24 min-w-0 rounded-[18px] border px-3 py-3 text-left transition ${
                                isSelected
                                  ? "border-[#064e3b] bg-[#f4f8f5] text-[#063f35] shadow-[0_10px_24px_rgba(6,63,53,0.08)]"
                                  : "border-[#dbe7e3] bg-white text-[#55746b] hover:bg-[#f8fbf7]"
                              }`}
                              key={mode.value}
                              onClick={() =>
                                updateSection(activeSection.draftId, {
                                  mode: mode.value,
                                })
                              }
                              type="button"
                            >
                              <span className="block text-sm font-semibold text-[#063f35]">
                                {mode.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5">
                                {mode.summary}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <label className="block text-sm font-medium text-[#173f36]">
                      จำนวนบ้านที่แสดง
                      <input
                        className="mt-2 h-11 w-full rounded-xl border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
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
                  </div>

                  <div className="grid gap-3 rounded-md border border-[#dbe6e1] bg-[#f8fbf9] p-3 md:grid-cols-[auto_1fr]">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#173f36]">
                      <input
                        checked={activeSection.ctaEnabled}
                        className="size-4 accent-[#075341]"
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
                      แสดงปุ่มดูเพิ่มเติม
                    </label>
                    <input
                      aria-label="ข้อความบนปุ่มดูเพิ่มเติม"
                      className="h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15 disabled:bg-[#eef3ef]"
                      disabled={!activeSection.ctaEnabled}
                      onChange={(event) =>
                        updateSection(activeSection.draftId, {
                          ctaLabel: event.target.value,
                        })
                      }
                      placeholder="ดูเพิ่มเติม"
                      value={activeSection.ctaLabel}
                    />
                  </div>

                  <details className="rounded-md border border-[#dbe6e1] bg-white px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-[#173f36]">
                      ตั้งค่าขั้นสูง
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                        ถ้าบ้านไม่ครบ
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

                  {activeSection.mode === "manual" ? (
                    <div className="grid gap-3 rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-[#173f36]">
                            บ้านพักในชุดนี้
                          </h3>
                          <p className="mt-0.5 text-xs text-[#58726a]">
                            พิมพ์เลขบ้านที่ต้องการแสดง เช่น 105 101 111
                          </p>
                        </div>
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isPreviewing}
                          onClick={handlePreviewManualIds}
                          type="button"
                        >
                          <Eye aria-hidden="true" className="size-4" />
                          {isPreviewing ? "กำลังตรวจสอบ..." : "ตรวจสอบบ้านพัก"}
                        </button>
                      </div>
                      <textarea
                        className="min-h-36 w-full rounded-[18px] border border-[#c9d9d3] bg-white px-3 py-2 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
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
                          activeSection.items
                            .map((item) => item.houseId)
                            .join(" ")
                        }
                      />
                    </div>
                  ) : (
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

                  <SectionVillaPreview
                    error={villaPreviewError}
                    isLoading={isLoadingVillaPreview}
                    villas={activePreviewVillas}
                  />
                </div>

                <aside className="grid content-start gap-3">
                  <div className="rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
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
                      แสดงชุดนี้บนหน้าแรก
                    </label>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-[#687d76]">ลำดับ</dt>
                        <dd className="font-mono font-semibold text-[#123f36]">
                          {activeSection.displayOrder + 1}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#687d76]">จำนวนบ้าน</dt>
                        <dd className="font-mono font-semibold text-[#123f36]">
                          {activeSection.mode === "manual"
                            ? activeSection.items.length
                            : activeSection.limitCount}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <SectionStatusCard items={activeStatusItems} />

                  {activeSection.mode !== "manual" ? (
                    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4 text-sm text-[#506862]">
                      บ้านพักจะถูกเลือกอัตโนมัติเมื่อบันทึกและเปิดหน้าแรก
                    </div>
                  ) : preview && previewDraftId === activeSection.draftId ? (
                    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4 text-sm">
                      <h3 className="font-semibold text-[#173f36]">
                        ผลการตรวจสอบ
                      </h3>
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
                              {villa.zoneLabel} / {villa.bedrooms} ห้องนอน /{" "}
                              พักได้ {villa.people} คน
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4 text-sm text-[#506862]">
                      กดตรวจสอบบ้านพักเพื่อดูว่าเลขบ้านไหนใช้งานได้ก่อนบันทึก
                    </div>
                  )}

                  {activeSection.mode === "manual" &&
                  activeSection.items.length > 0 ? (
                    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4">
                      <h3 className="text-sm font-semibold text-[#173f36]">
                        เลขบ้านที่ระบบอ่านได้
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

function SectionVillaPreview({
  error,
  isLoading,
  villas,
}: {
  error: string | null;
  isLoading: boolean;
  villas: VillaListing[];
}) {
  return (
    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#173f36]">
            ตัวอย่างบ้านบนหน้าแรก
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-[#58726a]">
            คำนวณจากข้อมูลที่กำลังแก้ ยังไม่ต้องบันทึกก่อนดู
          </p>
        </div>
        <span className="rounded-full bg-[#f4f8f5] px-2.5 py-1 text-xs font-semibold text-[#55746b]">
          {villas.length} หลัง
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 rounded-[18px] border border-dashed border-[#c9d9d3] bg-[#f8fbf7] px-4 py-8 text-center text-sm text-[#506862]">
          กำลังโหลดตัวอย่างบ้านพัก...
        </div>
      ) : error ? (
        <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : villas.length === 0 ? (
        <div className="mt-3 rounded-[18px] border border-dashed border-[#c9d9d3] bg-[#f8fbf7] px-4 py-8 text-center text-sm text-[#506862]">
          ยังไม่มีบ้านที่แสดงในชุดนี้
        </div>
      ) : (
        <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {villas.slice(0, 8).map((villa, villaIndex) => (
            <div
              className="w-[268px] shrink-0 snap-start"
              key={`preview-${villa.id}-${villaIndex}`}
            >
              <VillaCard villa={villa} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionStatusCard({ items }: { items: SectionStatusItem[] }) {
  return (
    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#173f36]">สถานะชุดนี้</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            className={`rounded-xl border px-3 py-2 ${STATUS_TONE_CLASS[item.tone]}`}
            key={`${item.label}-${item.detail}`}
          >
            <p className="text-xs font-semibold">{item.label}</p>
            <p className="mt-0.5 text-xs leading-5">{item.detail}</p>
          </div>
        ))}
      </div>
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
