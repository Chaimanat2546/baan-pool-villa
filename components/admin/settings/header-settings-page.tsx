"use client";

import { LayoutPanelTop } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { SectionCard } from "./settings-form-controls";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { useAdminSettingsSection } from "./use-admin-settings-section";
import type { ThemeSettingsDraft } from "./types";

type HeaderDraft = { desktopHeaderVariant: "centered-contact" | "right-booking" };

const OPTIONS: { value: HeaderDraft["desktopHeaderVariant"]; label: string; description: string }[] = [
  { value: "centered-contact", label: "เมนูกลางพร้อมติดต่อ", description: "เมนูอยู่กลาง พร้อมโทรและ LINE ด้านขวา" },
  { value: "right-booking", label: "เมนูขวาพร้อมจอง", description: "เมนูด้านขวา พร้อมปุ่มจองเลย" },
];

const HEADER_PREVIEW_SETTINGS = {
  ...DEFAULT_SITE_SETTINGS,
  siteName: "บ้านพักตัวอย่าง",
  bank: {
    accountName: "คุณมินท์ ใจดี",
    bankName: "ธนาคารตัวอย่าง",
    accountNumber: "123-4-56789-0",
  },
  contact: {
    phoneContacts: [{ name: "คุณมินท์", phone: "081-234-5678", time: "09.00-18.00" }],
    messengerUrl: "https://example.com/messenger",
    lineId: "@examplevilla",
    lineUrl: "https://example.com/line",
  },
};

export function HeaderSettingsPage() {
  const [previewTheme, setPreviewTheme] = useState<ThemeSettingsDraft | null>(null);
  const state = useAdminSettingsSection<HeaderDraft>({
    section: "header",
    endpoint: "/api/admin/site-header-settings",
    mapResponse: (value) => (value as { settings: HeaderDraft }).settings,
    makeSnapshot: JSON.stringify,
    buildRequest: (draft) => ({ body: JSON.stringify(draft), headers: { "Content-Type": "application/json" } }),
    validate: (draft) => OPTIONS.some((option) => option.value === draft.desktopHeaderVariant) ? [] : ["เลือกรูปแบบ Header"],
  });
  const draft = state.draft;

  useEffect(() => {
    let active = true;

    async function loadTheme() {
      const token = await readAdminAccessToken();
      if (!token) return;

      const response = await fetch("/api/admin/site-settings/theme", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null) as {
        settings?: ThemeSettingsDraft;
      } | null;

      if (active && response.ok && payload?.settings) setPreviewTheme(payload.settings);
    }

    void loadTheme();
    return () => { active = false; };
  }, []);

  return <div className="grid gap-5">
    <SettingsSectionHeader title="Header" description="เลือกรูปแบบ Header สำหรับ Desktop โดยไม่กระทบมือถือ" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <SectionCard icon={<LayoutPanelTop className="size-5" />} id="desktop-header-variant" title="รูปแบบ Header บน Desktop" description="มือถือคงรูปแบบเดิมเสมอ">
      <div className="grid gap-3 sm:grid-cols-2">{OPTIONS.map((option) => <label key={option.value} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--site-border)] p-4 has-[:checked]:border-[var(--site-primary)] has-[:checked]:bg-[var(--site-primary-soft)]"><input checked={draft.desktopHeaderVariant === option.value} name="desktopHeaderVariant" onChange={() => state.updateDraft({ desktopHeaderVariant: option.value })} type="radio" value={option.value} /><span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-[var(--site-text-muted)]">{option.description}</span></span></label>)}</div>
      <div className="mt-4 overflow-hidden rounded-lg" data-header-preview onAuxClickCapture={(event) => event.preventDefault()} onClickCapture={(event) => event.preventDefault()} onKeyDownCapture={(event) => { if (event.key === "Enter" || event.key === " ") event.preventDefault(); }}>
        <SiteHeader desktopHeaderVariant={draft.desktopHeaderVariant} previewMode settings={{ ...HEADER_PREVIEW_SETTINGS, ...previewTheme }} />
      </div>
    </SectionCard> : null}
  </div>;
}
