"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, ScrollText, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LegalPage } from "@/components/legal/legal-page";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminLegalSkeleton } from "@/components/admin/loading/admin-legal-skeleton";
import type { LegalPageSlug } from "@/lib/legal-pages/types";
import { LEGAL_PAGE_SLUGS, type LegalPage as LegalPageModel } from "@/lib/legal-pages/types";
import {
  buildPagePreview,
  extractLegalErrors,
  legalDateLabel,
  makeLegalSnapshot,
  makeSavePayload,
  normalizeLegalDrafts,
  pageLabel,
  readJsonPayload,
  shouldRedirectToLogin,
  textToBlocks,
} from "./legal-helpers";
import type {
  AdminLegalDraft,
  AdminLegalResponse,
  LegalApiErrorPayload,
} from "./types";

const PUBLIC_PAGE_BY_SLUG: Record<LegalPageSlug, string> = {
  terms: "/terms",
  privacy: "/privacy",
} as const;

type SavedLegalSnapshots = Record<LegalPageSlug, string>;

function legalStatusLabel(status: AdminLegalDraft["status"]): string {
  return status === "published" ? "เผยแพร่" : "ร่าง";
}

function makeSavedLegalSnapshots(drafts: AdminLegalDraft[]): SavedLegalSnapshots {
  return {
    privacy: makeLegalSnapshot(drafts.filter((draft) => draft.slug === "privacy")),
    terms: makeLegalSnapshot(drafts.filter((draft) => draft.slug === "terms")),
  };
}

function extractSavedDraft(payload: unknown): AdminLegalDraft | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const legalPage = (payload as { legalPage?: unknown }).legalPage;

  if (!legalPage || typeof legalPage !== "object") {
    return null;
  }

  const returnedSlug = (legalPage as { slug?: unknown }).slug;
  const draft = normalizeLegalDrafts({ legalPages: [legalPage] }).find(
    (candidate) => candidate.slug === returnedSlug,
  );

  return draft ?? null;
}

export function AdminLegalPagesPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AdminLegalDraft[]>(() =>
    normalizeLegalDrafts({ legalPages: [] }),
  );
  const [selectedSlug, setSelectedSlug] = useState<LegalPageSlug>("terms");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<SavedLegalSnapshots | null>(
    null,
  );
  const isSaveInFlightRef = useRef(false);

  const defaultDrafts = useMemo(
    () => normalizeLegalDrafts({ legalPages: [] }),
    [],
  );

  const draftBySlug = useMemo(
    () => new Map(drafts.map((draft) => [draft.slug, draft])),
    [drafts],
  );

  const selectedDraft =
    draftBySlug.get(selectedSlug) ??
    defaultDrafts.find((draft) => draft.slug === "terms")!;

  const hasUnsavedChanges = useMemo(() => {
    if (savedSnapshots === null) {
      return false;
    }

    return makeLegalSnapshot([selectedDraft]) !== savedSnapshots[selectedDraft.slug];
  }, [savedSnapshots, selectedDraft]);

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

  const loadPages = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setErrors([]);
      setNotice(null);

      try {
        const response = await fetch("/api/admin/legal-pages", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await readJsonPayload(response)) as
          | AdminLegalResponse
          | LegalApiErrorPayload
          | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          setErrors(extractLegalErrors(payload, "ไม่สามารถโหลดหน้ากฎหมายได้ในขณะนี้"));
          return;
        }

        const nextDrafts = normalizeLegalDrafts(payload);

        setDrafts(nextDrafts);
        setSavedSnapshots(makeSavedLegalSnapshots(nextDrafts));
        setSelectedSlug((current) =>
          nextDrafts.some((draft) => draft.slug === current) ? current : "terms",
        );
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถโหลดหน้ากฎหมายได้ในขณะนี้",
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const token = await getAccessToken();

      if (!token || !isMounted) {
        return;
      }

      await loadPages(token);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadPages]);

  function updateSelectedDraft(changes: Partial<AdminLegalDraft>) {
    setNotice(null);
    setErrors([]);

    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.slug === selectedDraft.slug ? { ...draft, ...changes } : draft,
      ),
    );
  }

  async function handleSave() {
    if (isSaveInFlightRef.current) {
      return;
    }

    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีการแก้ไขที่ต้องบันทึก");
      return;
    }

    isSaveInFlightRef.current = true;
    setIsSaving(true);
    setNotice(null);
    setErrors([]);

    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/legal-pages", {
        body: JSON.stringify(makeSavePayload(selectedDraft)),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      const payload = (await readJsonPayload(response)) as
        | { legalPage?: LegalPageModel }
        | LegalApiErrorPayload
        | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(
          extractLegalErrors(payload, "ไม่สามารถบันทึกหน้ากฎหมายได้ในขณะนี้"),
        );
        return;
      }

      const updatedDraft = extractSavedDraft(payload);

      if (!updatedDraft) {
        setErrors(["ไม่สามารถอัปเดตผลลัพธ์จาก API ได้"]);
        return;
      }

      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.slug === updatedDraft.slug ? updatedDraft : draft,
        ),
      );
      setSavedSnapshots((currentSnapshots) => ({
        ...(currentSnapshots ?? makeSavedLegalSnapshots(drafts)),
        [updatedDraft.slug]: makeLegalSnapshot([updatedDraft]),
      }));
      setNotice("บันทึกหน้ากฎหมายเรียบร้อยแล้ว");
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถบันทึกหน้ากฎหมายได้ในขณะนี้",
      ]);
    } finally {
      isSaveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <AdminLegalSkeleton />;
  }

  const previewPage = buildPagePreview(selectedDraft);

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="legalPagesHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              หน้าแอดมิน
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              หน้ากฎหมายของเว็บไซต์
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดการเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว พร้อมตัวอย่างสดก่อนเผยแพร่
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  hasUnsavedChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <AlertCircle aria-hidden="true" className="size-3.5" />
                {hasUnsavedChanges
                  ? "มีการแก้ไขยังไม่บันทึก"
                  : "ข้อมูลเป็นปัจจุบันแล้ว"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href={PUBLIC_PAGE_BY_SLUG[selectedDraft.slug]}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              หน้าเว็บ
            </Link>
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              disabled={isSaving || !hasUnsavedChanges}
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

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">เกิดข้อผิดพลาด:</p>
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

      <div className="grid min-w-0 gap-6 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="grid content-start gap-3 xl:sticky xl:top-36">
          {LEGAL_PAGE_SLUGS.map((slug) => {
            const draft = draftBySlug.get(slug);

            if (!draft) {
              return null;
            }

            const isActive = selectedDraft.slug === draft.slug;

            return (
              <button
                aria-label={`เปิด ${pageLabel(draft.slug)}`}
                aria-pressed={isActive}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] ${
                  isActive
                    ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-on-primary)]"
                    : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-text)] hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]/15"
                }`}
                data-legal-page={slug}
                disabled={isSaving}
                key={slug}
                onClick={() => {
                  setSelectedSlug(slug);
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex size-9 items-center justify-center rounded-lg ${
                    isActive
                      ? "bg-white/14 text-[var(--site-on-primary)]"
                      : "bg-[var(--site-surface-soft)] text-[var(--site-primary)]"
                  }`}
                >
                  <ScrollText className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="text-sm font-semibold">{pageLabel(draft.slug)}</span>
                  <span
                    className={`mt-1 block text-xs ${
                      isActive ? "text-white/80" : "text-[var(--site-muted)]"
                    }`}
                  >
                    สถานะ: {legalStatusLabel(draft.status)}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${
                      isActive ? "text-white/75" : "text-[var(--site-muted)]"
                    }`}
                  >
                    อัปเดต: {legalDateLabel(draft.updatedAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="grid min-w-0 gap-4">
          <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--site-text)]">รายละเอียดหน้า</h2>
            <p className="mt-1 text-sm text-[var(--site-muted)]">แก้ไขชื่อหน้าแสดงผล</p>

            <label className="mt-4 block text-sm font-medium text-[var(--site-text)]">
              ชื่อหน้า
              <input
                className="mt-1 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                disabled={isSaving}
                id="legalTitle"
                onChange={(event) => {
                  updateSelectedDraft({ title: event.target.value });
                }}
                value={selectedDraft.title}
              />
            </label>
          </section>

          <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--site-text)]">เนื้อหา</h2>
            <p className="mt-1 text-sm text-[var(--site-muted)]">
              ระบุเนื้อหาแบบข้อความธรรมดา โดยใช้ prefix:
              <span className="ml-1 whitespace-nowrap"># heading</span>,
              <span className="ml-1 whitespace-nowrap">&gt; quote</span>,
              <span className="ml-1 whitespace-nowrap">- bullet</span>,
              <span className="ml-1 whitespace-nowrap">1. numbered</span>
            </p>
            <label className="mt-4 block text-sm font-medium text-[var(--site-text)]">
              เนื้อหา
              <textarea
                className="mt-1 min-h-64 w-full resize-y rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm leading-6 text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                disabled={isSaving}
                id="legalContent"
                onChange={(event) => {
                  updateSelectedDraft({ contentText: event.target.value });
                }}
                value={selectedDraft.contentText}
                wrap="soft"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--site-text)]">SEO</h2>
            <p className="mt-1 text-sm text-[var(--site-muted)]">สรุปข้อความแสดงผล SEO ของหน้า</p>

            <label className="mt-4 block text-sm font-medium text-[var(--site-text)]">
              คำอธิบาย SEO
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm leading-6 text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                disabled={isSaving}
                id="legalSeoDescription"
                onChange={(event) => {
                  updateSelectedDraft({ seoDescription: event.target.value });
                }}
                value={selectedDraft.seoDescription}
              />
            </label>
          </section>

          <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--site-text)]">สถานะ</h2>
            <p className="mt-1 text-sm text-[var(--site-muted)]">กำหนดสถานะการเผยแพร่ของหน้า</p>

            <label className="mt-4 block text-sm font-medium text-[var(--site-text)]">
              สถานะ
              <select
                className="mt-1 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                disabled={isSaving}
                id="legalStatus"
                onChange={(event) => {
                  const nextStatus =
                    event.target.value === "published" ? "published" : "draft";

                  updateSelectedDraft({
                    status: nextStatus,
                    publishedAt:
                      nextStatus === "published"
                        ? selectedDraft.publishedAt ?? new Date().toISOString()
                        : null,
                  });
                }}
                value={selectedDraft.status}
              >
                <option value="draft">ร่าง</option>
                <option value="published">เผยแพร่</option>
              </select>
            </label>
          </section>
        </main>

        <aside className="grid content-start gap-4 xl:sticky xl:top-36">
          <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <h2 className="text-base font-semibold text-[var(--site-text)]">สถานะหน้า</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--site-muted)]">Slug</dt>
                <dd className="truncate font-semibold text-[var(--site-text)]">
                  {selectedDraft.slug}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--site-muted)]">อัปเดตล่าสุด</dt>
                <dd className="font-semibold text-[var(--site-text)]">
                  {legalDateLabel(selectedDraft.updatedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--site-muted)]">จำนวนบล็อก</dt>
                <dd className="font-semibold text-[var(--site-text)]">
                  {textToBlocks(selectedDraft.contentText).length.toLocaleString("th-TH")}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--site-muted)]">สถานะ</dt>
                <dd className="font-semibold text-[var(--site-text)]">
                  {legalStatusLabel(selectedDraft.status)}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)]"
            data-legal-preview="true"
          >
            <div className="border-b border-[var(--site-border)] px-4 py-3">
              <h2 className="text-base font-semibold text-[var(--site-text)]">ตัวอย่างหน้าจริง</h2>
            </div>
            <div className="max-h-[680px] overflow-auto">
              <LegalPage page={previewPage} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
