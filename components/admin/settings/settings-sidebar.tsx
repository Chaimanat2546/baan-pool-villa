"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ChevronDown, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";

import {
  extractErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "./settings-helpers";
import { useSettingsDirtyState } from "./settings-dirty-state";
import { SETTINGS_NAV_ITEMS } from "./settings-section-config";

type ExternalDataRefreshScope = "tags-only";

type SettingsNavigationEvent = {
  preventDefault: () => void;
};

type AdminExternalDataRefreshResponse = {
  error?: string;
  errors?: string[];
  message?: string;
  refreshed?: boolean;
  retryAfterSeconds?: number;
  scope?: ExternalDataRefreshScope;
};

function getScopeLabel(scope: ExternalDataRefreshScope | null): string {
  return scope === "tags-only"
    ? "อัปเดตเฉพาะหน้าหมวดหมู่ที่ใช้ข้อมูลเดียวกัน"
    : "อัปเดตตามที่เลือก";
}

function parseRetryAfterSeconds(
  payload: AdminExternalDataRefreshResponse | null,
): number | null {
  const value = payload?.retryAfterSeconds;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function parseRefreshScope(
  payload: AdminExternalDataRefreshResponse | null,
): ExternalDataRefreshScope | null {
  return payload?.scope === "tags-only" ? payload.scope : null;
}

export function SettingsSidebar() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const { isDirty } = useSettingsDirtyState();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingScope, setPendingScope] =
    useState<ExternalDataRefreshScope | null>(null);
  const [cooldownScope, setCooldownScope] =
    useState<ExternalDataRefreshScope | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  function handleNavigation(
    event: SettingsNavigationEvent,
    isActive: boolean,
  ) {
    if (isActive) return;

    if (
      isDirty &&
      !window.confirm(
        "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?",
      )
    ) {
      event.preventDefault();
      return;
    }

    setIsExpanded(false);
  }

  async function handleRefreshExternalData(scope: ExternalDataRefreshScope) {
    if (cooldownSeconds > 0 || isRefreshing) return;

    if (pendingScope !== scope) {
      setPendingScope(scope);
      setErrors([]);
      setNotice("ขอให้ตรวจสอบก่อนส่งคำขออัปเดตข้อมูลเฉพาะหน้าหมวดหมู่");
      return;
    }

    const token = await readAdminAccessToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    setIsRefreshing(true);
    setErrors([]);
    setNotice(null);

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

      setCooldownScope(responseScope);
      setCooldownSeconds(parseRetryAfterSeconds(payload) ?? 0);

      if (shouldRedirectToLogin(response.status, payload)) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        setPendingScope(null);
        setErrors(extractErrors(payload, "ไม่สามารถอัปเดตข้อมูลได้"));
        return;
      }

      setPendingScope(null);
      setNotice(
        `อัปเดตข้อมูล${
          responseScope ? ` (${getScopeLabel(responseScope)})` : ""
        } สำเร็จแล้ว`,
      );
    } catch (caughtError) {
      setPendingScope(null);
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถอัปเดตข้อมูลได้"),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }

  const isCoolingDown = cooldownSeconds > 0;

  return (
    <aside className="self-start rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm lg:sticky lg:top-6">
      <button
        aria-controls="settings-section-navigation"
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left lg:hidden"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--site-text)]">
          <Settings2 aria-hidden="true" className="size-4 text-[var(--site-primary)]" />
          เมนูการตั้งค่า
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className={isExpanded ? "block" : "hidden lg:block"}>
        <div className="hidden border-b border-[var(--site-border)] p-4 lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--site-primary)]">
            การตั้งค่าเว็บไซต์
          </p>
          <p className="mt-1 text-sm text-[var(--site-muted)]">
            เลือกข้อมูลที่ต้องการจัดการ
          </p>
        </div>

        <nav
          aria-label="ส่วนการตั้งค่าเว็บไซต์"
          className="grid gap-1 p-2"
          id="settings-section-navigation"
        >
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = segment === item.id;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-3 py-2.5 transition ${
                  isActive
                    ? "bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
                    : "text-[var(--site-text)] hover:bg-[var(--site-surface-tint)]"
                }`}
                href={item.href}
                key={item.id}
                onNavigate={(event) => handleNavigation(event, isActive)}
                prefetch={false}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--site-muted)]">
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--site-border)] p-3">
          <p className="px-1 text-xs font-semibold text-[var(--site-muted)]">
            เครื่องมือข้อมูลบ้านพัก
          </p>
          <button
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRefreshing || isCoolingDown}
            onClick={() => void handleRefreshExternalData("tags-only")}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            />
            {isRefreshing
              ? "กำลังรีเฟรชข้อมูล..."
              : isCoolingDown
                ? `รออีก ${cooldownSeconds} วินาที (${getScopeLabel(cooldownScope)})`
                : pendingScope === "tags-only"
                  ? "ยืนยันรีเฟรชข้อมูล"
                  : "รีเฟรชข้อมูลบ้านพัก"}
          </button>
          <div className="mt-3">
            <AdminFeedback
              errors={errors}
              errorTitle="ไม่สามารถอัปเดตข้อมูลได้:"
              notice={notice}
              warnings={[]}
              warningTitle=""
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
