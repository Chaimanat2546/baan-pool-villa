"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  LayoutPanelLeft,
  Plus,
  Save,
  Search,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
import { AdminGuidesSkeleton } from "@/components/admin/loading/admin-guides-skeleton";
import { useAdminSidebarCollapsed } from "@/components/admin/layout/admin-sidebar-preference";
import type {
  GuideDraft,
  GuideImage,
  GuidePost,
  GuideStatus,
} from "@/lib/guides/types";
import {
  createSlugFromTitle,
  validateGuideDraft,
  validateGuideUploadMetadata,
} from "@/lib/guides/validation";
import type { AdminGuideDraft } from "./admin-guide-types";
import {
  createEditableDraftId as makeDraftId,
  createEditableTextBlock as makeTextBlock,
  normalizeEditableBlocks as normalizeBlocks,
} from "./guide-editor-helpers";
import {
  BlockEditor,
  EditablePlainTextField,
} from "./guide-rich-text-editor";
import { GuideStatusPanel } from "./guide-status-panel";

interface AdminGuidesResponse {
  guides: GuidePost[];
}

interface AdminGuideResponse {
  guide: GuidePost;
}

interface AdminGuidesPageProps {
  guideId?: string;
}

function toAdminGuide(post: GuidePost): AdminGuideDraft {
  return {
    contentBlocks: normalizeBlocks(post.contentBlocks),
    coverImage: post.coverImage,
    createdAt: post.createdAt,
    draftId: post.id,
    excerpt: post.excerpt,
    id: post.id,
    isPinned: post.isPinned,
    publishedAt: post.publishedAt,
    recommendedHouseIds: post.recommendedHouseIds,
    slug: post.slug,
    status: post.status,
    tags: post.tags,
    title: post.title,
    updatedAt: post.updatedAt,
  };
}

function makeNewGuide(existingGuides: AdminGuideDraft[]): AdminGuideDraft {
  const number = existingGuides.length + 1;

  return {
    contentBlocks: [makeTextBlock("paragraph", "")],
    coverImage: null,
    draftId: makeDraftId(),
    excerpt: "",
    isPinned: false,
    publishedAt: null,
    recommendedHouseIds: [],
    slug: "",
    status: "draft",
    tags: [],
    title: `บทความใหม่ ${number}`,
  };
}

function makeSnapshot(guides: AdminGuideDraft[]) {
  return JSON.stringify(guides);
}

function getStatusLabel(status: GuideStatus) {
  return status === "published" ? "เผยแพร่" : "ฉบับร่าง";
}

function getGuideConfigHref(guide: AdminGuideDraft) {
  return `/admin/guides/${encodeURIComponent(
    guide.id ?? guide.slug ?? guide.draftId,
  )}`;
}

export function AdminGuidesPage({ guideId }: AdminGuidesPageProps) {
  const isListPage = guideId === undefined;
  const isNewGuidePage = guideId === "new";
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const router = useRouter();
  const [guides, setGuides] = useState<AdminGuideDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [guideSearch, setGuideSearch] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingUploadedCover, setPendingUploadedCover] = useState<{
    draftId: string;
    file: File;
    image: GuideImage;
  } | null>(null);

  const activeGuide = useMemo(
    () =>
      activeDraftId
        ? guides.find((guide) => guide.draftId === activeDraftId) ?? null
        : null,
    [activeDraftId, guides],
  );
  const visibleGuides = useMemo(() => {
    const query = guideSearch.trim().toLowerCase();

    if (!query) {
      return guides;
    }

    return guides.filter((guide) => {
      const searchableValues = [
        guide.title,
        guide.slug,
        guide.excerpt,
        ...guide.tags,
        ...guide.recommendedHouseIds,
      ];

      return searchableValues.some((value) => {
        return value.toLowerCase().includes(query);
      });
    });
  }, [guideSearch, guides]);
  const currentSnapshot = useMemo(() => makeSnapshot(guides), [guides]);
  const hasUnsavedChanges =
    savedSnapshot !== null &&
    (currentSnapshot !== savedSnapshot || pendingCoverFile !== null);
  const activePreviewHref = activeGuide
    ? `/guides/${createSlugFromTitle(activeGuide.title)}`
    : null;

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

  const loadGuides = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);

      try {
        const response = await fetch("/api/admin/guides", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonPayload(response);

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          setErrors(extractErrors(payload, "โหลดบทความไม่ได้"));
          return;
        }

        const mappedGuides = (
          (payload as AdminGuidesResponse).guides ?? []
        ).map(toAdminGuide);
        if (isListPage) {
          setGuides(mappedGuides);
          setActiveDraftId(null);
          setSavedSnapshot(makeSnapshot(mappedGuides));
          return;
        }

        if (isNewGuidePage) {
          const newGuide = makeNewGuide(mappedGuides);
          const initialGuides = [newGuide, ...mappedGuides];

          setGuides(initialGuides);
          setActiveDraftId(newGuide.draftId);
          setSavedSnapshot(makeSnapshot(initialGuides));
          return;
        }

        const matchedGuide =
          mappedGuides.find((guide) => {
            return (
              guide.id === guideId ||
              guide.slug === guideId ||
              guide.draftId === guideId
            );
          }) ?? null;

        setGuides(mappedGuides);
        setActiveDraftId(matchedGuide?.draftId ?? null);
        setSavedSnapshot(makeSnapshot(mappedGuides));

        if (!matchedGuide) {
          setErrors(["ไม่พบบทความที่ต้องการแก้ไข"]);
        }
      } catch (caughtError) {
        setErrors([getAdminErrorMessage(caughtError, "โหลดบทความไม่ได้")]);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [guideId, isListPage, isNewGuidePage, redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const token = await getAccessToken();

      if (!token || !isMounted) {
        return;
      }

      await loadGuides(token, true);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadGuides]);

  function updateActiveGuide(changes: Partial<AdminGuideDraft>) {
    if (!activeGuide) {
      return;
    }

    setErrors([]);
    setNotice(null);
    setGuides((currentGuides) =>
      currentGuides.map((guide) =>
        guide.draftId === activeGuide.draftId
          ? { ...guide, ...changes }
          : guide,
      ),
    );
  }

  async function uploadGuideImage(file: File, role: "cover" | "inline") {
    const validationErrors = validateGuideUploadMetadata(file.type, file.size);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setNotice(null);
      return null;
    }

    const token = await getAccessToken();

    if (!token) {
      return null;
    }

    const formData = new FormData();
    formData.set("image", file);
    formData.set("role", role);
    formData.set("guideId", activeGuide?.id ?? "");
    formData.set(
      "alt",
      role === "cover"
        ? activeGuide?.coverImage?.alt?.trim() || activeGuide?.title || ""
        : activeGuide?.title ?? "",
    );

    setIsUploading(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/guides/assets", {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      });
      const payload = await readJsonPayload(response);

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return null;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "อัปโหลดรูปบทความไม่ได้"));
        return null;
      }

      return (payload as { image: GuideImage }).image;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCoverSelect(file: File) {
    const validationErrors = validateGuideUploadMetadata(file.type, file.size);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setNotice(null);
      return;
    }

    setErrors([]);
    setNotice(null);
    setPendingCoverFile(file);
    setPendingUploadedCover(null);
  }

  async function handleInlineImageUpload(file: File) {
    return uploadGuideImage(file, "inline");
  }

  async function handleSave(coverFile = pendingCoverFile) {
    if (!activeGuide) {
      return;
    }

    let coverImage = activeGuide.coverImage;

    if (coverFile) {
      const reusableCover =
        pendingUploadedCover?.draftId === activeGuide.draftId &&
        pendingUploadedCover.file === coverFile
          ? pendingUploadedCover.image
          : null;

      coverImage = reusableCover ?? await uploadGuideImage(coverFile, "cover");

      if (coverImage && !reusableCover) {
        setPendingUploadedCover({
          draftId: activeGuide.draftId,
          file: coverFile,
          image: coverImage,
        });
      }
    }

    if (coverFile && !coverImage) {
      return;
    }

    const guideDraft: GuideDraft = {
      title: activeGuide.title,
      slug: createSlugFromTitle(activeGuide.title),
      excerpt: activeGuide.excerpt,
      coverImage,
      contentBlocks: normalizeBlocks(activeGuide.contentBlocks),
      tags: activeGuide.tags,
      recommendedHouseIds: activeGuide.recommendedHouseIds,
      status: activeGuide.status,
      isPinned: activeGuide.isPinned,
      publishedAt: activeGuide.publishedAt,
    };
    const validationErrors = validateGuideDraft(guideDraft);

    setErrors(validationErrors);
    setNotice(null);

    if (validationErrors.length > 0) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/guides", {
        body: JSON.stringify({
          guide: {
            ...guideDraft,
            id: activeGuide.id,
            slug: guideDraft.slug,
          },
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = await readJsonPayload(response);

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "บันทึกบทความไม่ได้"));
        return;
      }

      const savedGuide = toAdminGuide((payload as AdminGuideResponse).guide);

      setGuides((currentGuides) => {
        const nextGuides = currentGuides.map((guide) =>
          guide.draftId === activeGuide.draftId
            ? { ...savedGuide, draftId: savedGuide.id ?? activeGuide.draftId }
            : guide,
        );

        setSavedSnapshot(makeSnapshot(nextGuides));
        return nextGuides;
      });
      setActiveDraftId(savedGuide.id ?? activeGuide.draftId);
      setPendingCoverFile(null);
      setPendingUploadedCover(null);
      setNotice("บันทึกบทความแล้ว");
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "บันทึกบทความไม่ได้")]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeGuide) {
      return;
    }

    if (!activeGuide.id) {
      setGuides((currentGuides) => {
        const nextGuides = currentGuides.filter(
          (guide) => guide.draftId !== activeGuide.draftId,
        );
        const safeGuides =
          nextGuides.length > 0 ? nextGuides : [makeNewGuide([])];

        setActiveDraftId(safeGuides[0]?.draftId ?? null);
        return safeGuides;
      });
      return;
    }

    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/guides", {
        body: JSON.stringify({
          id: activeGuide.id,
          slug: activeGuide.slug,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = await readJsonPayload(response);

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "ลบบทความไม่ได้"));
        return;
      }

      setGuides((currentGuides) => {
        const nextGuides = currentGuides.filter(
          (guide) => guide.draftId !== activeGuide.draftId,
        );
        const safeGuides =
          nextGuides.length > 0 ? nextGuides : [makeNewGuide([])];

        setActiveDraftId(safeGuides[0]?.draftId ?? null);
        setSavedSnapshot(makeSnapshot(safeGuides));
        return safeGuides;
      });
    } catch {
      setErrors(extractErrors(null, "ลบบทความไม่ได้"));
      return;
    }
    setNotice("ลบบทความแล้ว");
  }

  if (isListPage) {
    return (
      <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
        <div
          className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
          id="guidesPageHeader"
        >
          <header className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
                Guides
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
                เลือกบทความสำหรับตั้งค่า
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
                เปิดรายการบทความก่อน แล้วค่อยเข้าไปตั้งค่าเนื้อหา รูปปก สถานะ และบ้านพักแนะนำของบทความนั้น
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--site-primary-soft)] px-3 py-1.5 text-[var(--site-primary)] ring-1 ring-[var(--site-primary)]/10">
                  <LayoutPanelLeft aria-hidden="true" className="size-3.5" />
                  {guides.length} บทความ
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)]"
                href="/admin/guides/new"
                prefetch={false}
              >
                <Plus aria-hidden="true" className="size-4" />
                เพิ่มบทความ
              </Link>
            </div>
          </header>
        </div>

        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <AdminFeedback
            errors={errors}
            errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
            notice={notice}
          />

          <section className="grid h-[calc(100dvh-14rem)] min-h-[32rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <label className="relative block">
              <span className="sr-only">ค้นหาบทความ</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--site-muted)]" />
              <input
                className="h-11 w-full rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] pl-9 pr-3 text-sm"
                onChange={(event) => {
                  setGuideSearch(event.target.value);
                }}
                placeholder="ค้นหาชื่อบทความ, slug, tag หรือบ้านพักแนะนำ"
                value={guideSearch}
              />
            </label>

            <div
              className="min-h-0 overflow-auto rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)]"
              data-admin-guides-table
            >
              {isLoading ? (
                <div
                  aria-hidden="true"
                  className="grid gap-2 p-3"
                  data-admin-guides-table-skeleton
                >
                  {Array.from({ length: 7 }, (_, index) => (
                    <div
                      className="grid gap-2 rounded-lg bg-[var(--site-surface)] p-4"
                      key={index}
                    >
                      <span className="h-4 w-48 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
                      <span className="h-3 w-72 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
                    </div>
                  ))}
                </div>
              ) : visibleGuides.length === 0 ? (
                <div
                  className="flex min-h-40 flex-col items-center justify-start gap-3 px-4 py-10 text-center text-sm text-[var(--site-muted)]"
                  data-admin-guides-empty
                >
                  <SearchX
                    aria-hidden="true"
                    className="size-10 text-[var(--site-primary)]"
                  />
                  <p className="font-semibold">ไม่พบบทความ</p>
                </div>
              ) : (
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--site-surface)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--site-muted)]">
                    <tr>
                      <th className="px-4 py-3">บทความ</th>
                      <th className="px-4 py-3">สถานะ</th>
                      <th className="px-4 py-3">บ้านพัก</th>
                      <th className="px-4 py-3">แท็ก</th>
                      <th className="px-4 py-3 text-right">ตั้งค่า</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--site-border)] bg-[var(--site-surface-soft)]">
                    {visibleGuides.map((guide) => (
                      <tr
                        className="transition hover:bg-[var(--site-primary-soft)]/55"
                        key={guide.draftId}
                      >
                        <td className="min-w-[18rem] px-4 py-3">
                          <Link
                            className="block truncate font-bold text-[var(--site-text)] hover:text-[var(--site-primary)]"
                            href={getGuideConfigHref(guide)}
                            prefetch={false}
                          >
                            {guide.title || "ยังไม่ได้ตั้งชื่อ"}
                          </Link>
                          <span className="mt-1 block truncate text-xs text-[var(--site-muted)]">
                            /guides/{createSlugFromTitle(guide.title)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                              guide.status === "published"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                            }`}
                          >
                            {getStatusLabel(guide.status)}
                          </span>
                          {guide.isPinned ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--site-primary)] px-2.5 py-1 text-[10px] font-bold text-[var(--site-on-primary)]">
                              ปักหมุด
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--site-muted)]">
                          {guide.recommendedHouseIds.length}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--site-muted)]">
                          {guide.tags.length}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-xs font-bold text-[var(--site-primary)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
                            href={getGuideConfigHref(guide)}
                            prefetch={false}
                          >
                            ตั้งค่า
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="guidesPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              คู่มือคอนเทนต์
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดการบทความไกด์
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดการบทความสำหรับหน้าไกด์ พร้อมพรีวิวสถานะ รูปปก
              และบ้านพักแนะนำในมุมมองเดียว
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
                  ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก"
                  : "บันทึกล่าสุดแล้ว"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--site-primary-soft)] px-3 py-1.5 text-[var(--site-primary)] ring-1 ring-[var(--site-primary)]/10">
                <LayoutPanelLeft aria-hidden="true" className="size-3.5" />
                {guides.length} บทความ
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href="/admin/guides"
              prefetch={false}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              ย้อนกลับ
            </Link>
            {activePreviewHref ? (
              <a
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
                href={activePreviewHref}
                rel="noreferrer"
                target="_blank"
              >
                <Eye aria-hidden="true" className="size-4" />
                ดูหน้าเว็บจริง
              </a>
            ) : null}

            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              data-guide-save="true"
              disabled={
                !activeGuide ||
                isSaving ||
                isLoading ||
                isUploading ||
                !hasUnsavedChanges
              }
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save
                aria-hidden="true"
                className={`size-4 ${isSaving ? "animate-pulse" : ""}`}
              />
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
        notice={notice}
      />

      {isLoading ? (
        <AdminGuidesSkeleton />
      ) : (
        <div
          className={`grid min-w-0 gap-6 ${
            isDesktopNavCollapsed
              ? "xl:grid-cols-[minmax(0,1fr)_420px]"
              : "xl:grid-cols-[minmax(0,1fr)_380px]"
          }`}
        >
          {activeGuide ? (
            <>
              <main className="min-w-0">
                <BlockEditor
                  key={activeGuide.draftId}
                  blocks={normalizeBlocks(activeGuide.contentBlocks)}
                  documentHeader={
                    <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 ring-1 ${activeGuide.status === "published" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}
                        >
                          {getStatusLabel(activeGuide.status)}
                        </span>
                        {activeGuide.isPinned ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--site-primary)] px-3 py-1.5 text-[10px] text-[var(--site-on-primary)]">
                            ปักหมุด
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <EditablePlainTextField
                          ariaLabel="ชื่อบทความ"
                          className="min-h-[2.75rem] w-full break-words text-3xl font-semibold leading-tight text-[var(--site-text)] outline-none sm:text-4xl"
                          onChange={(title) => {
                            updateActiveGuide({ title });
                          }}
                          placeholder="ชื่อบทความ"
                          value={activeGuide.title}
                        />
                      </div>
                      <div className="mt-3">
                        <EditablePlainTextField
                          ariaLabel="คำโปรยบทความ"
                          className="min-h-[2rem] w-full break-words text-lg leading-8 text-[var(--site-muted)] outline-none focus:text-[var(--site-text)]"
                          onChange={(excerpt) => {
                            updateActiveGuide({ excerpt });
                          }}
                          placeholder="คำโปรยสั้น ๆ ที่ทำให้คนอยากดูบ้านพักต่อ"
                          value={activeGuide.excerpt}
                        />
                      </div>
                    </div>
                  }
                  isDesktopNavCollapsed={isDesktopNavCollapsed}
                  onChange={(contentBlocks) => {
                    updateActiveGuide({ contentBlocks });
                  }}
                  onUploadImage={handleInlineImageUpload}
                />
              </main>

              <div className="min-w-0 xl:sticky xl:top-36 xl:self-start">
                <GuideStatusPanel
                  key={activeGuide.draftId}
                  guide={activeGuide}
                  hasUnsavedChanges={hasUnsavedChanges}
                  isSaving={isSaving}
                  isUploading={isUploading}
                  onCoverSelect={handleCoverSelect}
                  onDelete={handleDelete}
                  onSave={handleSave}
                  onUpdate={updateActiveGuide}
                  pendingCoverFile={pendingCoverFile}
                  statusLabel={getStatusLabel(activeGuide.status)}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
