"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Save } from "lucide-react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import {
  buildSettingsFormData,
  extractErrors,
  extractWarnings,
  makeSettingsSnapshot,
  mapSettingsToDraft,
  readJsonPayload,
  shouldRedirectToLogin,
} from "./settings-helpers";
import { SettingsForm } from "./settings-form";
import type {
  AdminSettingsDraft,
  AdminSiteSettingsResponse,
} from "./types";

type AdminExternalDataRefreshResponse =
  | {
      message?: string;
      refreshed?: boolean;
    }
  | {
      error?: string;
      errors?: string[];
    };

/**
 * Admin page UI for viewing and editing site appearance and contact settings.
 *
 * Loads current site settings into an editable draft, displays loading/errors/notices/warnings,
 * and provides controls to save changes, refresh external data, and open the live site.
 * Handles access-token retrieval and redirects to the admin login when authentication fails.
 *
 * @returns The React element that renders the Admin Settings page
 */
export function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<AdminSettingsDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingExternalData, setIsRefreshingExternalData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    if (!draft || savedSnapshot === null) {
      return false;
    }

    return makeSettingsSnapshot(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

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

  const loadSettings = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);
      setNotice(null);
      setWarnings([]);

      try {
        const response = await fetch("/api/admin/site-settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await readJsonPayload(
          response,
        )) as AdminSiteSettingsResponse | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload?.settings) {
          setErrors(extractErrors(payload, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"));
          return;
        }

        const nextDraft = mapSettingsToDraft(payload.settings);

        setSettings(payload.settings);
        setDraft(nextDraft);
        setSavedSnapshot(makeSettingsSnapshot(nextDraft));
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถโหลดข้อมูลการตั้งค่าได้",
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

        await loadSettings(token, true);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถเริ่มต้นหน้า Settings ได้",
        ]);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSettings]);

  function updateDraft(changes: Partial<AdminSettingsDraft>) {
    setNotice(null);
    setErrors([]);
    setWarnings([]);
    setDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, ...changes } : currentDraft,
    );
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีข้อมูลที่เปลี่ยนแปลงให้บันทึก");
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/admin/site-settings", {
        body: buildSettingsFormData(draft),
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "PUT",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminSiteSettingsResponse | null;

      if (
        shouldRedirectToLogin(
          response.status,
          payload as AdminSiteSettingsResponse | null,
        )
      ) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractErrors(payload, "ไม่สามารถบันทึกการตั้งค่าได้"));
        return;
      }

      const nextDraft = mapSettingsToDraft(payload.settings);

      setSettings(payload.settings);
      setDraft(nextDraft);
      setSavedSnapshot(makeSettingsSnapshot(nextDraft));
      await loadSettings(token, false);
      setWarnings(extractWarnings(payload));
      setNotice("บันทึกการตั้งค่าสำเร็จ");
      router.refresh();
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถบันทึกการตั้งค่าได้",
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshExternalData() {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsRefreshingExternalData(true);
    setErrors([]);
    setNotice(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/admin/external-data/refresh", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "POST",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminExternalDataRefreshResponse | null;

      if (
        shouldRedirectToLogin(
          response.status,
          payload as AdminSiteSettingsResponse | null,
        )
      ) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "ไม่สามารถรีเฟรชข้อมูลบ้านพักได้"));
        return;
      }

      setNotice("ส่งคำขอรีเฟรชข้อมูลบ้านพักแล้ว");
      router.refresh();
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถรีเฟรชข้อมูลบ้านพักได้",
      ]);
    } finally {
      setIsRefreshingExternalData(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="settingsPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              การตั้งค่าเว็บไซต์
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดการภาพลักษณ์และข้อมูลติดต่อ
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              ปรับแบรนด์ สี รูปหลัก SEO และข้อมูลติดต่อที่ใช้จริงบนหน้าเว็บจากหน้าจอเดียว
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
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRefreshingExternalData || isSaving}
              onClick={() => {
                void handleRefreshExternalData();
              }}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${isRefreshingExternalData ? "animate-spin" : ""}`}
              />
              {isRefreshingExternalData
                ? "กำลังรีเฟรชข้อมูล..."
                : "รีเฟรชข้อมูลบ้านพัก"}
            </button>
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href="/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              ดูหน้าเว็บจริง
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
              {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </button>
          </div>
        </header>
      </div>

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">กรุณาแก้ไขก่อนบันทึก:</p>
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

      {warnings.length > 0 ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-semibold">บันทึกแล้วพร้อมคำเตือน:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-8 text-center text-sm text-[var(--site-muted)]">
          กำลังโหลดการตั้งค่าเว็บไซต์...
        </div>
      ) : settings && draft ? (
        <SettingsForm
          draft={draft}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          onChange={updateDraft}
          onSave={handleSave}
          settings={settings}
        />
      ) : null}
    </div>
  );
}
