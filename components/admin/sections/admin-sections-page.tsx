"use client";

import {
  CheckCircle2,
  Eye,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
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
import { AdminSectionsSkeleton } from "@/components/admin/loading/admin-sections-skeleton";
import {
  moveHomePageLayoutItem,
  parseHomePageLayout,
  validateHomePageLayout,
} from "@/lib/home-sections/layout";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type {
  FixedHomeSectionKey,
  HomePageLayoutItem,
} from "@/lib/home-sections/types";

import type {
  AdminHomeSectionsResponse,
  AdminManualPreviewResponse,
  AdminSectionDraft,
} from "./types";
import { AutoModeSummary } from "./auto-mode-summary";
import {
  type ManualHouseOption,
  ManualIdsEditor,
} from "./manual-ids-editor";
import { ManualHouseOrderDialog } from "./manual-house-order-dialog";
import { SectionConfigForm } from "./section-config-form";
import { FIXED_SECTION_LABELS, SectionList } from "./section-list";
import {
  getManualIdStatus,
  getPreviewForSection,
  getSectionLabel,
  MODE_LABELS,
} from "./section-helpers";
import {
  isAbortSignalAborted,
  makeHomePageConfigSnapshot,
  makeNewSection,
  mapResponseHomePageConfig,
} from "./section-draft-helpers";

type LoginRedirectReason = "admin-access";
type SectionFieldKey = "title" | "description" | "limitCount" | "manualIds";
type SectionFieldErrors = Partial<Record<SectionFieldKey, string[]>>;
type SectionFieldErrorsByDraftId = Record<string, SectionFieldErrors>;
type SectionErrorTarget = {
  draftId: string;
  field: SectionFieldKey;
};

function addFieldError(
  fieldErrors: SectionFieldErrorsByDraftId,
  firstTarget: SectionErrorTarget | null,
  draftId: string,
  field: SectionFieldKey,
  message: string,
): SectionErrorTarget {
  const sectionErrors = fieldErrors[draftId] ?? {};
  sectionErrors[field] = [...(sectionErrors[field] ?? []), message];
  fieldErrors[draftId] = sectionErrors;

  return firstTarget ?? { draftId, field };
}

function getSectionFieldErrors(sections: AdminSectionDraft[]): {
  fieldErrors: SectionFieldErrorsByDraftId;
  firstTarget: SectionErrorTarget | null;
} {
  const fieldErrors: SectionFieldErrorsByDraftId = {};
  let firstTarget: SectionErrorTarget | null = null;

  for (const section of sections) {
    if (!section.title.trim()) {
      firstTarget = addFieldError(
        fieldErrors,
        firstTarget,
        section.draftId,
        "title",
        "ต้องมีชื่อชุดบ้านพัก",
      );
    }

    if (!section.description.trim()) {
      firstTarget = addFieldError(
        fieldErrors,
        firstTarget,
        section.draftId,
        "description",
        "ต้องมีคำอธิบาย",
      );
    }

    if (!Number.isSafeInteger(section.limitCount) || section.limitCount < 1) {
      firstTarget = addFieldError(
        fieldErrors,
        firstTarget,
        section.draftId,
        "limitCount",
        "จำนวนบ้านสูงสุดที่แสดงต้องเป็นเลขตั้งแต่ 1 ขึ้นไป",
      );
    }

    if (section.mode === "manual") {
      const manualStatus = getManualIdStatus(section);

      if (manualStatus.invalidIds.length > 0) {
        firstTarget = addFieldError(
          fieldErrors,
          firstTarget,
          section.draftId,
          "manualIds",
          `รูปแบบเลขบ้านไม่ถูกต้อง: ${manualStatus.invalidIds.join(", ")}`,
        );
      }

      if (manualStatus.duplicateIds.length > 0) {
        firstTarget = addFieldError(
          fieldErrors,
          firstTarget,
          section.draftId,
          "manualIds",
          `มีเลขบ้านซ้ำ: ${manualStatus.duplicateIds.join(", ")}`,
        );
      }
    }
  }

  return { fieldErrors, firstTarget };
}

function FieldErrors({
  errors,
  field,
  id,
}: {
  errors?: string[];
  field: SectionFieldKey;
  id: string;
}) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <ul
      className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold leading-5 text-red-700"
      data-admin-section-field-error={field}
      id={id}
    >
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

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

const FIXED_SECTION_GUIDANCE: Record<
  FixedHomeSectionKey,
  { description: string; ownerHref?: string; ownerLabel?: string }
> = {
  why_choose: {
    description:
      "ส่วนนี้ใช้ข้อมูลและรูปแบบที่ระบบหน้าแรกกำหนดไว้ เลือกเปิด ปิด หรือจัดลำดับได้จากรายการด้านซ้าย",
  },
  tiktok: {
    description:
      "คลิปและบัญชีที่แสดงในส่วนนี้จัดการจากหน้าคอนเทนต์ TikTok",
    ownerHref: "/admin/tiktok",
    ownerLabel: "ไปจัดการ TikTok",
  },
  customer_reviews: {
    description:
      "ข้อความรีวิวและสถานะเผยแพร่จัดการจากหน้าความคิดเห็นลูกค้า",
    ownerHref: "/admin/customer-reviews",
    ownerLabel: "ไปจัดการรีวิวจากลูกค้า",
  },
  articles: {
    description:
      "บทความที่แสดงในส่วนนี้มาจากรายการบทความแนะนำที่เผยแพร่แล้ว",
    ownerHref: "/admin/guides",
    ownerLabel: "ไปจัดการบทความ",
  },
  faq: {
    description:
      "คำถามที่พบบ่อยเป็นส่วนของระบบหน้าแรก หน้านี้จัดการได้เฉพาะลำดับและการแสดงผล",
  },
  contact: {
    description:
      "ช่องทางติดต่อและข้อมูลที่แสดงในส่วนนี้ใช้ค่าจากการตั้งค่าการติดต่อ",
    ownerHref: "/admin/settings/contact",
    ownerLabel: "ไปตั้งค่าการติดต่อ",
  },
};

function FixedSectionPanel({
  sectionKey,
}: {
  sectionKey: FixedHomeSectionKey;
}) {
  const guidance = FIXED_SECTION_GUIDANCE[sectionKey];

  return (
    <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
      <span className="rounded bg-[var(--site-primary-soft)] px-2 py-1 text-xs font-semibold text-[var(--site-primary)]">
        ส่วนของระบบ
      </span>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--site-text)]">
        {FIXED_SECTION_LABELS[sectionKey]}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
        {guidance.description}
      </p>
      {guidance.ownerHref ? (
        <a
          className="mt-5 inline-flex h-10 items-center rounded-md border border-[var(--site-border-strong)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]"
          href={guidance.ownerHref}
        >
          {guidance.ownerLabel}
        </a>
      ) : null}
    </section>
  );
}

function mapValidatedHomePageConfig(
  payload: unknown,
  existingSections: AdminSectionDraft[] = [],
) {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid response");
    }

    const response = payload as Record<string, unknown>;
    const parsedLayout = parseHomePageLayout(response.layout);
    if (
      parsedLayout.errors.length > 0 ||
      !Array.isArray(response.sections) ||
      !response.sections.every(isAdminHomeSectionRow)
    ) {
      throw new Error("Invalid response");
    }

    const config = mapResponseHomePageConfig(
      {
        layout: parsedLayout.items,
        sections: response.sections,
      },
      existingSections,
    );
    const snapshot = makeHomePageConfigSnapshot(
      config.layout,
      config.sections,
    );
    const validationErrors = validateHomePageLayout(
      config.layout,
      config.sections.map((section) => section.slug),
    );

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join("\n"));
    }

    return {
      ...config,
      snapshot: JSON.stringify(snapshot),
    };
  } catch {
    throw new Error("ไม่สามารถใช้ข้อมูลหน้าแรกที่เซิร์ฟเวอร์ส่งกลับได้");
  }
}

function isAdminHomeSectionRow(
  value: unknown,
): value is AdminHomeSectionsResponse["sections"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    typeof row.title === "string" &&
    typeof row.description === "string" &&
    typeof row.mode === "string" &&
    typeof row.fallbackMode === "string" &&
    typeof row.sliceOffset === "number" &&
    Number.isSafeInteger(row.sliceOffset) &&
    typeof row.isActive === "boolean" &&
    typeof row.limitCount === "number" &&
    Number.isSafeInteger(row.limitCount) &&
    typeof row.displayOrder === "number" &&
    Number.isSafeInteger(row.displayOrder) &&
    typeof row.ctaEnabled === "boolean" &&
    typeof row.ctaLabel === "string" &&
    typeof row.ctaHref === "string" &&
    Array.isArray(row.items) &&
    row.items.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }

      const sectionItem = item as Record<string, unknown>;
      return (
        typeof sectionItem.houseId === "string" &&
        typeof sectionItem.isActive === "boolean" &&
        (sectionItem.position === undefined ||
          (typeof sectionItem.position === "number" &&
            Number.isSafeInteger(sectionItem.position)))
      );
    })
  );
}

function readResponseWarnings(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const warnings = (payload as Record<string, unknown>).warnings;
  return Array.isArray(warnings)
    ? warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
}

export function AdminSectionsPage() {
  const router = useRouter();
  const titleErrorTargetRef = useRef<HTMLLabelElement | null>(null);
  const descriptionErrorTargetRef = useRef<HTMLLabelElement | null>(null);
  const limitCountErrorTargetRef = useRef<HTMLDivElement | null>(null);
  const manualIdsErrorTargetRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<HomePageLayoutItem[]>([]);
  const [sections, setSections] = useState<AdminSectionDraft[]>([]);
  const [activeLayoutIdentity, setActiveLayoutIdentity] = useState<
    string | null
  >(null);
  const [draggedLayoutIdentity, setDraggedLayoutIdentity] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] =
    useState<SectionFieldErrorsByDraftId>({});
  const [pendingErrorTarget, setPendingErrorTarget] =
    useState<SectionErrorTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualHouses, setManualHouses] = useState<ManualHouseOption[]>([]);
  const [manualHouseOrderDialogDraftId, setManualHouseOrderDialogDraftId] =
    useState<string | null>(null);
  const [pendingDeleteDraftId, setPendingDeleteDraftId] = useState<
    string | null
  >(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const activeLayoutItem =
    layout.find(
      (item) => `${item.kind}:${item.key}` === activeLayoutIdentity,
    ) ?? null;
  const activeSection = useMemo(
    () =>
      activeLayoutItem?.kind === "rail"
        ? (sections.find(
            (section) => section.slug === activeLayoutItem.key,
          ) ?? null)
        : null,
    [activeLayoutItem, sections],
  );
  const activeIndex = activeLayoutItem
    ? layout.indexOf(activeLayoutItem)
    : -1;
  const hasErrors = errors.length > 0;
  const currentSnapshot = useMemo(
    () => JSON.stringify(makeHomePageConfigSnapshot(layout, sections)),
    [layout, sections],
  );
  const currentSnapshotRef = useRef(currentSnapshot);
  const sectionsRef = useRef(sections);
  const activeLayoutIdentityRef = useRef(activeLayoutIdentity);
  const saveInFlightRef = useRef(false);
  const hasUnsavedChanges =
    savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const activeSectionsCount = useMemo(
    () => layout.filter((item) => item.enabled).length + 1,
    [layout],
  );
  const deleteNeedsConfirmation =
    activeSection !== null && pendingDeleteDraftId === activeSection.draftId;
  const activeManualDraftId =
    activeSection?.mode === "manual" ? activeSection.draftId : null;
  const activeManualHouseIdsKey =
    activeSection?.mode === "manual"
      ? activeSection.items.map((item) => item.houseId).join("\n")
      : "";
  const activeManualHouseOrderOptions = useMemo(() => {
    if (activeSection?.mode !== "manual") {
      return [];
    }

    const manualHousesById = new Map(
      manualHouses.map((house) => [house.id, house]),
    );

    return activeSection.items.map(({ houseId }) => {
      const house = manualHousesById.get(houseId);

      return {
        coverImage: house?.coverImage ?? null,
        id: houseId,
        title: house?.title ?? `บ้าน ${houseId}`,
      };
    });
  }, [activeSection, manualHouses]);
  const activeModeLabel = activeSection
    ? (MODE_LABELS.get(activeSection.mode) ?? activeSection.mode)
    : null;
  const activeFieldErrors = activeSection
    ? (fieldErrors[activeSection.draftId] ?? {})
    : {};

  useLayoutEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
    sectionsRef.current = sections;
    activeLayoutIdentityRef.current = activeLayoutIdentity;
  }, [activeLayoutIdentity, currentSnapshot, sections]);

  useEffect(() => {
    if (
      manualHouseOrderDialogDraftId !== null &&
      manualHouseOrderDialogDraftId !== activeManualDraftId
    ) {
      setManualHouseOrderDialogDraftId(null);
    }
  }, [activeManualDraftId, manualHouseOrderDialogDraftId]);

  useEffect(() => {
    if (
      !pendingErrorTarget ||
      activeSection?.draftId !== pendingErrorTarget.draftId
    ) {
      return;
    }

    const targetElement =
      pendingErrorTarget.field === "title"
        ? titleErrorTargetRef.current
        : pendingErrorTarget.field === "description"
          ? descriptionErrorTargetRef.current
          : pendingErrorTarget.field === "limitCount"
            ? limitCountErrorTargetRef.current
            : manualIdsErrorTargetRef.current;

    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    targetElement
      .querySelector<HTMLElement>("input, textarea, button, select")
      ?.focus({ preventScroll: true });
    setPendingErrorTarget(null);
  }, [activeSection?.draftId, pendingErrorTarget]);

  function clearValidationFeedback() {
    setErrors([]);
    setWarnings([]);
    setFieldErrors({});
    setPendingErrorTarget(null);
  }

  const redirectToLogin = useCallback((reason?: LoginRedirectReason) => {
    const loginPath =
      reason === "admin-access"
        ? "/admin/login?error=admin-access"
        : "/admin/login";

    try {
      void createBrowserHomeConfigClient()
        .auth.signOut({ scope: "local" })
        .finally(() => {
          router.replace(loginPath);
        });
    } catch {
      router.replace(loginPath);
    }
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
    async (
      token: string,
      showLoading: boolean,
      selectedLayoutIdentity: string | null,
    ) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);
      setWarnings([]);
      setFieldErrors({});
      setPendingErrorTarget(null);

      try {
        const response = await fetch("/api/admin/home-sections", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await readJsonPayload(response);

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin("admin-access");
          return;
        }

        if (!response.ok || !payload) {
          setErrors(extractErrors(payload, "ไม่สามารถโหลดการจัดหน้าแรกได้"));
          return;
        }

        const mappedConfig = mapValidatedHomePageConfig(payload);
        const nextActiveLayoutIdentity =
          mappedConfig.layout.some(
            (item) =>
              `${item.kind}:${item.key}` === selectedLayoutIdentity,
          )
            ? selectedLayoutIdentity
            : mappedConfig.layout[0]
              ? `${mappedConfig.layout[0].kind}:${mappedConfig.layout[0].key}`
              : null;

        setLayout(mappedConfig.layout);
        setSections(mappedConfig.sections);
        setSavedSnapshot(mappedConfig.snapshot);
        setManualHouses([]);
        setFieldErrors({});
        setPendingErrorTarget(null);
        setActiveLayoutIdentity(nextActiveLayoutIdentity);
        setPendingDeleteDraftId(null);
      } catch (caughtError) {
        setErrors([
          getAdminErrorMessage(caughtError, "ไม่สามารถโหลดการจัดหน้าแรกได้"),
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

        await loadSections(token, true, null);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setErrors([
          getAdminErrorMessage(
            caughtError,
            "ไม่สามารถเริ่มต้นหน้าจัดหน้าแรกได้",
          ),
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
    clearValidationFeedback();
    setPendingDeleteDraftId(null);
    if ("items" in changes || "mode" in changes) {
      setWarnings([]);
    }
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.draftId === draftId ? { ...section, ...changes } : section,
      ),
    );
  }

  function addSection() {
    setNotice(null);
    clearValidationFeedback();
    setPendingDeleteDraftId(null);
    const nextSection = makeNewSection(sections);
    setSections([...sections, nextSection]);
    setLayout([
      ...layout,
      { enabled: true, key: nextSection.slug, kind: "rail" },
    ]);
    setActiveLayoutIdentity(`rail:${nextSection.slug}`);
  }

  function deleteSection(draftId: string) {
    setNotice(null);
    clearValidationFeedback();
    setPendingDeleteDraftId(null);
    const deletedSection = sections.find(
      (section) => section.draftId === draftId,
    );
    if (!deletedSection) return;

    const nextLayout = layout.filter(
      (item) =>
        !(item.kind === "rail" && item.key === deletedSection.slug),
    );
    setSections(
      sections.filter((section) => section.draftId !== draftId),
    );
    setLayout(nextLayout);
    setActiveLayoutIdentity(
      nextLayout[0]
        ? `${nextLayout[0].kind}:${nextLayout[0].key}`
        : null,
    );
  }

  function moveLayoutItem(fromIndex: number, toIndex: number) {
    setNotice(null);
    clearValidationFeedback();
    setPendingDeleteDraftId(null);
    setLayout((currentLayout) =>
      moveHomePageLayoutItem(currentLayout, fromIndex, toIndex),
    );
  }

  function handleDragStart(identity: string) {
    setPendingDeleteDraftId(null);
    setDraggedLayoutIdentity(identity);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(targetIdentity: string) {
    if (!draggedLayoutIdentity || draggedLayoutIdentity === targetIdentity) {
      setDraggedLayoutIdentity(null);
      return;
    }

    const fromIndex = layout.findIndex(
      (item) => `${item.kind}:${item.key}` === draggedLayoutIdentity,
    );
    const toIndex = layout.findIndex(
      (item) => `${item.kind}:${item.key}` === targetIdentity,
    );

    moveLayoutItem(fromIndex, toIndex);
    setDraggedLayoutIdentity(null);
  }

  function selectLayoutItem(identity: string) {
    setActiveLayoutIdentity(identity);
    setPendingDeleteDraftId(null);
  }

  function toggleLayoutItem(identity: string, enabled: boolean) {
    setNotice(null);
    clearValidationFeedback();
    setPendingDeleteDraftId(null);
    setLayout((currentLayout) =>
      currentLayout.map((item) =>
        `${item.kind}:${item.key}` === identity
          ? { ...item, enabled }
          : item,
      ),
    );

    if (identity.startsWith("rail:")) {
      const slug = identity.slice("rail:".length);
      setSections((currentSections) =>
        currentSections.map((section) =>
          section.slug === slug ? { ...section, isActive: enabled } : section,
        ),
      );
    }
  }

  function requestDeleteSection(draftId: string) {
    if (pendingDeleteDraftId === draftId) {
      deleteSection(draftId);
      return;
    }

    setNotice(null);
    clearValidationFeedback();
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

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin("admin-access");
        return null;
      }

      if (!response.ok) {
        throw new Error(extractErrors(payload, "เช็กเลขบ้านไม่ได้").join("\n"));
      }

      return payload as AdminManualPreviewResponse;
    },
    [redirectToLogin],
  );

  const searchManualHouses = useCallback(
    async (query: string, selectedHouseIds: string[]) => {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const params = new URLSearchParams();
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("search", trimmedQuery);
      } else if (selectedHouseIds.length > 0) {
        params.set("ids", selectedHouseIds.join(","));
      } else {
        setManualHouses([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/home-sections/houses?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await readJsonPayload(response);
        const housePayload = payload as { houses?: unknown } | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin("admin-access");
          return;
        }

        if (
          !response.ok ||
          !housePayload ||
          !Array.isArray(housePayload.houses)
        ) {
          setManualHouses([]);
          return;
        }

        setManualHouses((currentHouses) => {
          const housesById = new Map(
            currentHouses.map((house) => [house.id, house]),
          );

          for (const house of housePayload.houses as ManualHouseOption[]) {
            housesById.set(house.id, house);
          }

          return [...housesById.values()];
        });
      } catch {
        setManualHouses([]);
      }
    },
    [getAccessToken, redirectToLogin],
  );

  const previewManualIds = useCallback(
    async ({
      draftId,
      houseIds,
      houseIdsKey,
      layoutIdentity,
      showErrors,
      signal,
    }: {
      draftId: string;
      houseIds: string[];
      houseIdsKey: string;
      layoutIdentity: string;
      showErrors: boolean;
      signal?: AbortSignal;
    }) => {
      if (houseIds.length === 0) {
        setIsPreviewing(false);
        return;
      }

      const token = await getAccessToken();

      if (!token || isAbortSignalAborted(signal)) {
        return;
      }

      setErrors([]);
      setFieldErrors({});
      setPendingErrorTarget(null);
      setNotice(null);
      setIsPreviewing(true);

      try {
        const payload = await fetchManualPreview(token, houseIds, signal);

        if (!payload || isAbortSignalAborted(signal)) {
          return;
        }

        const currentSection = sectionsRef.current.find(
          (section) => section.draftId === draftId,
        );
        const currentHouseIdsKey = currentSection?.items
          .map((item) => item.houseId)
          .join("\n");
        if (
          activeLayoutIdentityRef.current !== layoutIdentity ||
          currentHouseIdsKey !== houseIdsKey
        ) {
          return;
        }

        const manualIdsErrors = [
          ...(payload.missingIds.length > 0
            ? [
                `ไม่พบเลขบ้านในรายการบ้าน: ${payload.missingIds.join(", ")}`,
              ]
            : []),
          ...(payload.invalidIds.length > 0
            ? [
                `เลขบ้านรูปแบบไม่ถูกต้อง: ${payload.invalidIds.join(", ")}`,
              ]
            : []),
        ];

        if (manualIdsErrors.length > 0) {
          setFieldErrors((currentErrors) => ({
            ...currentErrors,
            [draftId]: {
              ...currentErrors[draftId],
              manualIds: manualIdsErrors,
            },
          }));
          setPendingErrorTarget({ draftId, field: "manualIds" });
          setNotice(null);
        } else {
          setNotice("ตรวจเลขบ้านแล้ว");
        }
      } catch (caughtError) {
        const isAbortError =
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError";

        if (isAbortError || isAbortSignalAborted(signal) || !showErrors) {
          return;
        }

        setErrors([getAdminErrorMessage(caughtError, "เช็กเลขบ้านไม่ได้")]);
      } finally {
        if (!isAbortSignalAborted(signal)) {
          setIsPreviewing(false);
        }
      }
    },
    [fetchManualPreview, getAccessToken],
  );

  async function handlePreviewActiveManualIds() {
    if (!activeManualDraftId || !activeManualHouseIdsKey) {
      return;
    }

    await previewManualIds({
      draftId: activeManualDraftId,
      houseIds: activeManualHouseIdsKey.split("\n"),
      houseIdsKey: activeManualHouseIdsKey,
      layoutIdentity: activeLayoutIdentity ?? "",
      showErrors: true,
    });
  }

  async function validateManualSectionsBeforeSave(
    token: string,
    submittedSections: AdminSectionDraft[],
    submittedSnapshot: string,
  ) {
    const manualSections = submittedSections
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

    const previewFieldErrors: SectionFieldErrorsByDraftId = {};
    let firstPreviewTarget: SectionErrorTarget | null = null;
    let firstProblem: AdminSectionDraft | null = null;

    for (const { section, sectionIndex } of manualSections) {
      const sectionPreview = getPreviewForSection(section, combinedPreview);
      const issueCount =
        sectionPreview.missingIds.length + sectionPreview.invalidIds.length;

      if (issueCount === 0) {
        continue;
      }

      firstProblem ??= section;
      const sectionLabel = getSectionLabel(section, sectionIndex);

      if (sectionPreview.missingIds.length > 0) {
        firstPreviewTarget = addFieldError(
          previewFieldErrors,
          firstPreviewTarget,
          section.draftId,
          "manualIds",
          `${sectionLabel} มีเลขบ้านที่ไม่พบในรายการบ้าน: ${sectionPreview.missingIds.join(", ")}`,
        );
      }

      if (sectionPreview.invalidIds.length > 0) {
        firstPreviewTarget = addFieldError(
          previewFieldErrors,
          firstPreviewTarget,
          section.draftId,
          "manualIds",
          `${sectionLabel} มีเลขบ้านที่รูปแบบไม่ถูกต้อง: ${sectionPreview.invalidIds.join(", ")}`,
        );
      }
    }

    if (firstProblem) {
      if (currentSnapshotRef.current !== submittedSnapshot) {
        return false;
      }
      setActiveLayoutIdentity(`rail:${firstProblem.slug}`);
    }

    if (firstPreviewTarget) {
      if (currentSnapshotRef.current !== submittedSnapshot) {
        return false;
      }
      setErrors([]);
      setFieldErrors(previewFieldErrors);
      const targetSection = submittedSections.find(
        (section) => section.draftId === firstPreviewTarget.draftId,
      );
      setActiveLayoutIdentity(
        targetSection ? `rail:${targetSection.slug}` : activeLayoutIdentity,
      );
      setPendingErrorTarget(firstPreviewTarget);
      return false;
    }

    return true;
  }

  async function handleSave() {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีรายการที่เปลี่ยนใหม่");
      return;
    }

    const submittedSections = sections;
    const configSnapshot = makeHomePageConfigSnapshot(layout, sections);
    const submittedSnapshot = JSON.stringify(configSnapshot);
    const sectionDrafts = configSnapshot.sections;
    const validationErrors = validateHomeSectionDrafts(sectionDrafts);
    const sectionFieldErrors = getSectionFieldErrors(sections);

    setNotice(null);
    setWarnings([]);
    setErrors(sectionFieldErrors.firstTarget ? [] : validationErrors);
    setFieldErrors(sectionFieldErrors.fieldErrors);

    if (validationErrors.length > 0) {
      if (sectionFieldErrors.firstTarget) {
        const targetSection = sections.find(
          (section) =>
            section.draftId === sectionFieldErrors.firstTarget?.draftId,
        );
        setActiveLayoutIdentity(
          targetSection ? `rail:${targetSection.slug}` : activeLayoutIdentity,
        );
        setPendingErrorTarget(sectionFieldErrors.firstTarget);
      }
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

      const manualSectionsAreReady =
        await validateManualSectionsBeforeSave(
          token,
          submittedSections,
          submittedSnapshot,
        );

      if (!manualSectionsAreReady) {
        return;
      }

      const response = await fetch("/api/admin/home-sections", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configSnapshot),
      });
      const payload = await readJsonPayload(response);

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin("admin-access");
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

      const mappedConfig = mapValidatedHomePageConfig(
        payload,
        submittedSections,
      );

      setNotice("บันทึกการจัดหน้าแรกแล้ว");
      setSavedSnapshot(mappedConfig.snapshot);
      setWarnings(readResponseWarnings(payload));
      if (currentSnapshotRef.current === submittedSnapshot) {
        const currentActiveLayoutIdentity =
          activeLayoutIdentityRef.current;
        setFieldErrors({});
        setPendingErrorTarget(null);
        setLayout(mappedConfig.layout);
        setSections(mappedConfig.sections);
        setManualHouses([]);
        setActiveLayoutIdentity(
          mappedConfig.layout.some(
            (item) =>
              `${item.kind}:${item.key}` === currentActiveLayoutIdentity,
          )
            ? currentActiveLayoutIdentity
            : mappedConfig.layout[0]
              ? `${mappedConfig.layout[0].kind}:${mappedConfig.layout[0].key}`
              : null,
        );
        setPendingDeleteDraftId(null);
      }
    } catch (caughtError) {
      setFieldErrors({});
      setPendingErrorTarget(null);
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถบันทึกการจัดหน้าแรกได้"),
      ]);
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="adminSectionsPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              ชุดบ้านพัก
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดชุดบ้านพักหน้าแรก
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
              จัดลำดับส่วนต่าง ๆ เปิดหรือปิดการแสดงผล
              และกำหนดวิธีคัดบ้านก่อนบันทึก
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
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
              <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
                ทั้งหมด {sections.length} ชุด
              </span>
              <span className="rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-text)] ring-1 ring-[var(--site-border)]">
                เปิดใช้งาน {activeSectionsCount} ส่วน
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
            <a
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href="/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              ดูหน้าเว็บจริง
            </a>
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
              {isSaving ? "กำลังตรวจและบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={hasErrors ? errors : []}
        errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
        notice={notice}
        warnings={warnings}
      />

      {isLoading ? (
        <AdminSectionsSkeleton />
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <aside className="grid content-start gap-3 lg:sticky lg:top-24 lg:self-start">
            <div className="px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-muted)]">
                Master
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--site-text)]">
                ส่วนต่าง ๆ บนหน้าแรก
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                Hero อยู่บนสุดเสมอ ส่วนด้านล่างเรียงลำดับและเปิดปิดได้
              </p>
            </div>
            <SectionList
              activeLayoutIdentity={activeLayoutIdentity}
              layout={layout}
              onDragEnd={() => setDraggedLayoutIdentity(null)}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onMove={moveLayoutItem}
              onSelect={selectLayoutItem}
              onToggle={toggleLayoutItem}
              sections={sections}
            />
          </aside>

          {activeLayoutItem?.kind === "fixed" ? (
            <FixedSectionPanel sectionKey={activeLayoutItem.key} />
          ) : activeSection ? (
              <section className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
                <div className="border-b border-[var(--site-border)] bg-[var(--site-surface-soft)]/80 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
                        Detail
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          ลำดับที่ {activeIndex + 2}
                        </span>
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          {activeModeLabel}
                        </span>
                        <span className="rounded-full bg-[var(--site-surface)] px-2.5 py-1 text-[var(--site-muted)] ring-1 ring-[var(--site-border)]">
                          {activeSection.limitCount.toLocaleString("th-TH")}{" "}
                          หลัง
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold text-[var(--site-text)]">
                        {activeSection.title || "ยังไม่ได้ตั้งชื่อชุด"}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
                        ปรับข้อความ วิธีคัดบ้าน
                        และสถานะการแสดงผลของชุดนี้ก่อนบันทึกขึ้นหน้าแรก
                      </p>
                      {deleteNeedsConfirmation ? (
                        <p className="mt-3 text-sm font-semibold text-red-700">
                          กด &quot;ยืนยันลบ&quot; อีกครั้งเพื่อลบชุดนี้
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
                  <SectionEditorGroup
                    description="ข้อความส่วนนี้คือหัวข้อและคำโปรยที่ลูกค้าเห็นบนหน้าแรก"
                    title="รายละเอียดชุดบ้านพัก"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <label
                        className="scroll-mt-52 block text-sm font-medium text-[var(--site-text)] lg:scroll-mt-48"
                        data-admin-section-error-target="title"
                        ref={titleErrorTargetRef}
                      >
                        ชื่อชุดบ้านพัก
                        <input
                          aria-describedby={
                            activeFieldErrors.title
                              ? "admin-section-title-error"
                              : undefined
                          }
                          aria-invalid={Boolean(activeFieldErrors.title)}
                          className={`mt-1 h-11 w-full rounded-md border bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition ${
                            activeFieldErrors.title
                              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                              : "border-[var(--site-border)] focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                          }`}
                          onChange={(event) => {
                            updateSection(activeSection.draftId, {
                              title: event.target.value,
                            });
                          }}
                          placeholder="เช่น บ้านพักแนะนำ"
                          value={activeSection.title}
                        />
                        <FieldErrors
                          errors={activeFieldErrors.title}
                          field="title"
                          id="admin-section-title-error"
                        />
                      </label>

                      <label
                        className="scroll-mt-52 block text-sm font-medium text-[var(--site-text)] md:row-span-2 lg:scroll-mt-48"
                        data-admin-section-error-target="description"
                        ref={descriptionErrorTargetRef}
                      >
                        คำอธิบาย
                        <textarea
                          aria-describedby={
                            activeFieldErrors.description
                              ? "admin-section-description-error"
                              : undefined
                          }
                          aria-invalid={Boolean(activeFieldErrors.description)}
                          className={`mt-1 min-h-28 w-full rounded-md border bg-[var(--site-surface)] px-3 py-2 text-sm text-[var(--site-text)] outline-none transition ${
                            activeFieldErrors.description
                              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                              : "border-[var(--site-border)] focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                          }`}
                          onChange={(event) => {
                            updateSection(activeSection.draftId, {
                              description: event.target.value,
                            });
                          }}
                          placeholder="ข้อความสั้น ๆ ที่แสดงใต้หัวข้อชุดบ้านพัก"
                          value={activeSection.description}
                        />
                        <FieldErrors
                          errors={activeFieldErrors.description}
                          field="description"
                          id="admin-section-description-error"
                        />
                      </label>
                    </div>
                  </SectionEditorGroup>

                  <SectionEditorGroup
                    description="กำหนดว่าจะให้ระบบเลือกบ้านแบบไหน จำนวนกี่หลัง และจะเติมบ้านเพิ่มหรือไม่"
                    title="วิธีเลือกและจำนวนบ้าน"
                  >
                    <div
                      className="scroll-mt-52 lg:scroll-mt-48"
                      data-admin-section-error-target="limitCount"
                      ref={limitCountErrorTargetRef}
                    >
                      <SectionConfigForm
                        errors={{
                          limitCount: activeFieldErrors.limitCount,
                        }}
                        onChange={(changes) => {
                          updateSection(activeSection.draftId, changes);
                        }}
                        section={activeSection}
                      />
                    </div>
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
                      <div
                        className="scroll-mt-52 grid gap-3 lg:scroll-mt-48"
                        data-admin-section-error-target="manualIds"
                        ref={manualIdsErrorTargetRef}
                      >
                        <ManualIdsEditor
                          errors={activeFieldErrors.manualIds}
                          houses={manualHouses}
                          onChange={(nextHouseIds) => {
                            updateSection(activeSection.draftId, {
                              items: nextHouseIds.map((houseId) => ({
                                houseId,
                                isActive: true,
                              })),
                            });
                          }}
                          onSearch={searchManualHouses}
                          selectedHouseIds={activeSection.items.map(
                            (item) => item.houseId,
                          )}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={activeSection.items.length === 0}
                            onClick={() => {
                              setManualHouseOrderDialogDraftId(
                                activeSection.draftId,
                              );
                            }}
                            type="button"
                          >
                            เรียงบ้าน
                          </button>
                          <button
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              isPreviewing || activeSection.items.length === 0
                            }
                            onClick={() => {
                              void handlePreviewActiveManualIds();
                            }}
                            type="button"
                          >
                            <CheckCircle2
                              aria-hidden="true"
                              className={`size-4 ${isPreviewing ? "animate-pulse" : ""}`}
                            />
                            {isPreviewing
                              ? "กำลังเช็กเลขบ้าน..."
                              : "เช็กเลขบ้าน"}
                          </button>
                          <p className="text-xs leading-5 text-[var(--site-muted)]">
                            ระบบจะตรวจซ้ำให้อีกครั้งตอนกดบันทึก
                          </p>
                        </div>
                        <ManualHouseOrderDialog
                          houses={activeManualHouseOrderOptions}
                          onConfirm={(nextHouseIds) => {
                            updateSection(activeSection.draftId, {
                              items: nextHouseIds.map((houseId, position) => ({
                                houseId,
                                isActive: true,
                                position,
                              })),
                            });
                            setManualHouseOrderDialogDraftId(null);
                          }}
                          onOpenChange={(open) => {
                            setManualHouseOrderDialogDraftId(
                              open ? activeSection.draftId : null,
                            );
                          }}
                          open={
                            manualHouseOrderDialogDraftId ===
                            activeSection.draftId
                          }
                        />
                      </div>
                    ) : (
                      <AutoModeSummary mode={activeSection.mode} />
                    )}
                  </SectionEditorGroup>
                </div>
              </section>
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-10 text-center">
              <div className="max-w-md">
                <h2 className="text-xl font-semibold text-[var(--site-text)]">
                  ยังไม่มีชุดบ้านพัก
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  เพิ่มชุดบ้านพักเพื่อเริ่มกำหนดข้อความและวิธีคัดบ้าน
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
