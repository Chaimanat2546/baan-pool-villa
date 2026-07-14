"use client";

import { LayoutPanelTop, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminVillaCardImagesPage } from "@/components/admin/villa-card-images/admin-villa-card-images-page";
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

export function WebStyleSettingsPage() {
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
  const selectedOption = OPTIONS.find((option) => option.value === draft?.desktopHeaderVariant);

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
    <SettingsSectionHeader title="รูปแบบเว็บ" description="เลือกรูปแบบ Header และการ์ดบ้าน โดยไม่กระทบมือถือ" />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <SectionCard action={<button className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:opacity-70" data-header-style-save disabled={state.isSaving || !state.hasUnsavedChanges} onClick={() => void state.save()} type="button"><Save aria-hidden="true" className={state.isSaving ? "size-4 animate-pulse" : "size-4"} />{state.isSaving ? "กำลังบันทึก..." : "บันทึกรูปแบบ Header"}</button>} icon={<LayoutPanelTop className="size-5" />} id="desktop-header-variant" title="รูปแบบ Header บน Desktop" description="มือถือคงรูปแบบเดิมเสมอ">
      <div className="grid gap-3 sm:grid-cols-2">{OPTIONS.map((option) => <label key={option.value} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--site-border)] p-4 has-[:checked]:border-[var(--site-primary)] has-[:checked]:bg-[var(--site-primary-soft)]"><input checked={draft.desktopHeaderVariant === option.value} name="desktopHeaderVariant" onChange={() => state.updateDraft({ desktopHeaderVariant: option.value })} type="radio" value={option.value} /><span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-[var(--site-text-muted)]">{option.description}</span></span></label>)}</div>
      <div className="mt-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 lg:hidden" data-header-mobile-summary>
        <p className="text-sm font-semibold text-[var(--site-text)]">{selectedOption?.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">{selectedOption?.description}</p>
        <p className="mt-3 text-xs font-medium text-[var(--site-muted)]">การตั้งค่านี้มีผลกับ Header บน Desktop เท่านั้น</p>
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg lg:block" data-header-preview onAuxClickCapture={(event) => event.preventDefault()} onClickCapture={(event) => event.preventDefault()} onKeyDownCapture={(event) => { if (event.key === "Enter" || event.key === " ") event.preventDefault(); }}>
        <SiteHeader desktopHeaderVariant={draft.desktopHeaderVariant} previewMode settings={{ ...HEADER_PREVIEW_SETTINGS, ...previewTheme }} />
      </div>
    </SectionCard> : null}
    <AdminVillaCardImagesPage embedded />
  </div>;
}
