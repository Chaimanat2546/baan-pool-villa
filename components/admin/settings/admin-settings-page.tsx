"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Save } from "lucide-react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { AdminSettingsSkeleton } from "@/components/admin/loading/admin-settings-skeleton";
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
import { validateAdminSettingsDraftForClient } from "./settings-validation";
import type {
  AdminSettingsDraft,
  AdminSiteSettingsResponse,
} from "./types";

type AdminExternalDataRefreshResponse =
  | {
      message?: string;
      refreshed?: boolean;
      retryAfterSeconds?: number;
      scope?: ExternalDataRefreshScope;
    }
  | {
      error?: string;
      errors?: string[];
      retryAfterSeconds?: number;
      scope?: ExternalDataRefreshScope;
    };

type ExternalDataRefreshScope = "tags-only";

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
  const [externalRefreshPendingScope, setExternalRefreshPendingScope] =
    useState<ExternalDataRefreshScope | null>(null);
  const [externalRefreshCooldownScope, setExternalRefreshCooldownScope] =
    useState<ExternalDataRefreshScope | null>(null);
  const [externalRefreshCooldownSeconds, setExternalRefreshCooldownSeconds] =
    useState(0);
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
          getAdminErrorMessage(caughtError, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"),
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
          getAdminErrorMessage(caughtError, "ไม่สามารถเริ่มต้นหน้า Settings ได้"),
        ]);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSettings]);

  useEffect(() => {
    if (externalRefreshCooldownSeconds <= 0) {
      return;
    }

    const cooldownTimer = window.setTimeout(() => {
      setExternalRefreshCooldownSeconds((current) => {
        const nextSeconds = current - 1;

        return nextSeconds > 0 ? nextSeconds : 0;
      });
    }, 1_000);

    return () => {
      window.clearTimeout(cooldownTimer);
    };
  }, [externalRefreshCooldownSeconds]);

  function updateDraft(changes: Partial<AdminSettingsDraft>) {
    setNotice(null);
    setErrors([]);
    setWarnings([]);
    setDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, ...changes } : currentDraft,
    );
  }

  const isExternalRefreshCoolingDown = externalRefreshCooldownSeconds > 0;

  function getScopeLabel(scope: ExternalDataRefreshScope | null): string {
    if (scope === "tags-only") {
      return "อัปเดตเฉพาะหน้าหมวดหมู่ที่ใช้ข้อมูลเดียวกัน";
    }

    return "อัปเดตตามที่เลือก";
  }

  function parseRetryAfterSeconds(
    payload: AdminExternalDataRefreshResponse | null,
  ): number | null {
    const retryAfterSeconds =
      payload &&
      typeof payload.retryAfterSeconds === "number" &&
      Number.isInteger(payload.retryAfterSeconds)
        ? payload.retryAfterSeconds
        : null;

    return retryAfterSeconds !== null && retryAfterSeconds > 0
      ? retryAfterSeconds
      : null;
  }

  function parseRefreshScope(
    payload: AdminExternalDataRefreshResponse | null,
  ): ExternalDataRefreshScope | null {
    const value = payload ? "scope" in payload ? payload.scope : null : null;

    if (value === "tags-only") {
      return value;
    }

    return null;
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

    const validationErrors = validateAdminSettingsDraftForClient(draft);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setNotice(null);
      setWarnings([]);
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
      setWarnings(extractWarnings(payload));
      setNotice("บันทึกการตั้งค่าสำเร็จ");
    } catch (caughtError) {
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถบันทึกการตั้งค่าได้"),
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshExternalData(scope: ExternalDataRefreshScope) {
    if (isExternalRefreshCoolingDown || isRefreshingExternalData) {
      return;
    }

    if (externalRefreshPendingScope !== scope) {
      setExternalRefreshPendingScope(scope);
      setErrors([]);
      setWarnings([]);
      setNotice(
        "ขอให้ตรวจสอบก่อนส่งคำขออัปเดตข้อมูลเฉพาะหน้าหมวดหมู่",
      );
      return;
    }

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
          "x-admin-refresh-confirmation": "external-villa-cache",
          "x-admin-refresh-scope": scope,
        },
        method: "POST",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminExternalDataRefreshResponse | null;

      const responseScope = parseRefreshScope(payload);
      const responseRetryAfterSeconds = parseRetryAfterSeconds(payload);

      setExternalRefreshCooldownScope(responseScope);
      setExternalRefreshCooldownSeconds(responseRetryAfterSeconds ?? 0);

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
        setExternalRefreshPendingScope(null);
        setErrors(extractErrors(payload, "ไม่สามารถอัปเดตข้อมูลได้"));
        return;
      }

      setExternalRefreshPendingScope(null);
      setNotice(
        `อัปเดตข้อมูล${
          responseScope ? ` (${getScopeLabel(responseScope)})` : ""
        } สำเร็จแล้ว`,
      );
    } catch (caughtError) {
      setExternalRefreshPendingScope(null);
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถอัปเดตข้อมูลได้"),
      ]);
    } finally {
      setIsRefreshingExternalData(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="settingsPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
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
              disabled={
                isRefreshingExternalData ||
                isSaving ||
                isExternalRefreshCoolingDown
              }
              onClick={() => {
                void handleRefreshExternalData("tags-only");
              }}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${isRefreshingExternalData ? "animate-spin" : ""}`}
              />
              {isRefreshingExternalData
                ? "กำลังรีเฟรชข้อมูล..."
                : isExternalRefreshCoolingDown
                  ? `รออีก ${externalRefreshCooldownSeconds} วินาที (${getScopeLabel(
                    externalRefreshCooldownScope,
                  )})`
                  : externalRefreshPendingScope === "tags-only"
                    ? "ยืนยันรีเฟรชข้อมูล"
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
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="กรุณาแก้ไขก่อนบันทึก:"
        notice={notice}
        warnings={warnings}
        warningTitle="บันทึกแล้วพร้อมคำเตือน:"
      />

      {isLoading ? (
        <AdminSettingsSkeleton />
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
