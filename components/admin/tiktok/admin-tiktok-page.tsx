"use client";

import { CheckCircle2, Eye, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { AdminTikTokSkeleton } from "@/components/admin/loading/admin-tiktok-skeleton";
import {
  readJsonPayload,
} from "../settings/settings-helpers";

import { TikTokForm } from "./tiktok-form";
import {
  EMPTY_TIKTOK_DRAFT,
  buildTikTokFormData,
  extractTikTokErrors,
  shouldRedirectTikTokToLogin,
  extractTikTokWarnings,
  mapTikTokSettingsToDraft,
  makeTikTokSnapshot,
} from "./tiktok-helpers";
import type { AdminTikTokDraft, AdminTikTokResponse } from "./types";

/**
 * Render the admin UI for managing TikTok account and video settings.
 *
 * Displays current settings, loading/saving states, error/warning/notice messages,
 * and controls to edit and persist changes to the server.
 *
 * @returns The React element for the TikTok administration page.
 */
export function AdminTikTokPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminTikTokDraft>(EMPTY_TIKTOK_DRAFT);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    if (savedSnapshot === null) {
      return false;
    }

    return makeTikTokSnapshot(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

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

  const loadSettings = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);
      setNotice(null);
      setWarnings([]);

      try {
        const response = await fetch("/api/admin/tiktok", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await readJsonPayload(
          response,
        )) as AdminTikTokResponse | null;

        if (shouldRedirectTikTokToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload?.settings) {
          setErrors(extractTikTokErrors(payload, "ไม่สามารถโหลดการตั้งค่า TikTok ได้"));
          return;
        }

        const nextDraft = mapTikTokSettingsToDraft(payload.settings);

        setDraft(nextDraft);
        setSavedSnapshot(makeTikTokSnapshot(nextDraft));
      } catch (caughtError) {
        setErrors([
          getAdminErrorMessage(caughtError, "ไม่สามารถโหลดการตั้งค่า TikTok ได้"),
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
      const token = await getAccessToken();

      if (!token || !isMounted) {
        return;
      }

      await loadSettings(token, true);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSettings]);

  function updateDraft(changes: Partial<AdminTikTokDraft>) {
    setErrors([]);
    setNotice(null);
    setWarnings([]);

    setDraft((currentDraft) => ({ ...currentDraft, ...changes }));
  }

  async function handleSave() {
    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีการเปลี่ยนแปลงที่ต้องบันทึก");
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);
    setWarnings([]);

    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/tiktok", {
        body: buildTikTokFormData(draft),
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "PUT",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminTikTokResponse | null;

      if (shouldRedirectTikTokToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractTikTokErrors(payload, "ไม่สามารถบันทึกการตั้งค่า TikTok ได้"));
        return;
      }

      const nextDraft = mapTikTokSettingsToDraft(payload.settings);

      setDraft(nextDraft);
      setSavedSnapshot(makeTikTokSnapshot(nextDraft));
      setWarnings(extractTikTokWarnings(payload));
      setNotice("บันทึกการตั้งค่า TikTok สำเร็จ");
    } catch (caughtError) {
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถบันทึกการตั้งค่า TikTok ได้"),
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="tiktokPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              TikTok
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดการ TikTok
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดการบัญชีและวิดีโอ TikTok สำหรับแสดงบนหน้าแรก
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
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
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
              <Save aria-hidden="true" className={`size-4 ${isSaving ? "animate-pulse" : ""}`} />
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="ไม่สามารถบันทึกหรือโหลดได้:"
        notice={notice}
        warnings={warnings}
      />

      {isLoading ? (
        <AdminTikTokSkeleton />
      ) : (
        <TikTokForm
          draft={draft}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          onChange={updateDraft}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
