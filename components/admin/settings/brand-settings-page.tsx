"use client";

import { Building2 } from "lucide-react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { SITE_LOGO_BACKGROUND_CLASSES, SITE_LOGO_BACKGROUND_LABELS, SITE_LOGO_BACKGROUNDS } from "@/lib/site-settings/logo-background";
import { validateUploadMetadata } from "@/lib/site-settings/validation";
import { AssetUploadField } from "./asset-upload-field";
import { SectionCard, TextControl } from "./settings-form-controls";
import { buildBrandSettingsFormData, makeBrandSettingsSnapshot, mapBrandSettingsResponse } from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { validateBrandSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";

export function BrandSettingsPage() {
  const state = useAdminSettingsSection({
    section: "brand",
    mapResponse: mapBrandSettingsResponse,
    makeSnapshot: makeBrandSettingsSnapshot,
    buildRequest: (draft) => ({ body: buildBrandSettingsFormData(draft) }),
    validate: validateBrandSettingsDraft,
  });
  const { draft } = state;
  return <div className="grid gap-5">
    <SettingsSectionHeader title="ข้อมูลแบรนด์" description="ดูแลชื่อเว็บไซต์ โลโก้ และตัวตนหลักของหน้าเว็บให้สอดคล้องกันทุกจุด" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <SectionCard description="ชื่อเว็บไซต์ โลโก้ และไอคอนที่ใช้งานจริง" icon={<Building2 aria-hidden="true" className="size-5" />} id="identity" title="ข้อมูลแบรนด์">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><TextControl id="siteName" label="ชื่อเว็บไซต์" description="ชื่อนี้จะใช้เป็นชื่อหลักของเว็บไซต์และแสดงในตัวอย่างด้านขวา" placeholder="Pool Villas Pattaya" value={draft.siteName} onChange={(siteName) => state.updateDraft({ siteName })} /></div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><p className="text-sm font-semibold text-[var(--site-text)]">สรุปแบรนด์</p><dl className="mt-3 grid gap-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">ชื่อที่ใช้งาน</dt><dd className="text-right font-semibold">{draft.siteName || "ยังไม่ได้ระบุ"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">โลโก้ใหม่</dt><dd className="max-w-36 truncate text-right font-semibold">{draft.logoFile?.name ?? "ยังไม่ได้เลือก"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">ไอคอนใหม่</dt><dd className="max-w-36 truncate text-right font-semibold">{draft.faviconFile?.name ?? "ยังไม่ได้เลือก"}</dd></div></dl></div>
        </div>
        <AssetUploadField currentAlt={draft.logoImage.alt} currentLabel="โลโก้ปัจจุบัน" currentUrl={draft.logoImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับโลโก้หน้าเว็บ" id="logoFile" label="โลโก้" selectedFile={draft.logoFile} onFileChange={(logoFile) => state.updateDraft({ logoFile })} validateFile={(file) => validateUploadMetadata("logo", file.type, file.size, file.name)} />
        <AssetUploadField currentAlt={draft.faviconImage.alt} currentLabel="ไอคอนปัจจุบัน" currentUrl={draft.faviconImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับไอคอนแท็บเบราว์เซอร์และไอคอนบนมือถือ" id="faviconFile" label="ไอคอนเว็บไซต์" selectedFile={draft.faviconFile} onFileChange={(faviconFile) => state.updateDraft({ faviconFile })} validateFile={(file) => validateUploadMetadata("favicon", file.type, file.size, file.name)} />
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><p className="text-sm font-semibold">พื้นหลังโลโก้</p><p className="mt-1 text-xs text-[var(--site-muted)]">ใช้กับโลโก้ใน Header และ Footer เมื่อไฟล์โลโก้ไม่มีพื้นหลัง</p><div className="mt-3 grid gap-2 sm:grid-cols-4">{SITE_LOGO_BACKGROUNDS.map((background) => { const isActive = draft.logoBackground === background; return <button aria-pressed={isActive} className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] ${isActive ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] text-[var(--site-primary)]" : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-text)] hover:border-[var(--site-border-strong)]"}`} key={background} onClick={() => state.updateDraft({ logoBackground: background })} type="button" value={background}><span className={`mb-2 block h-8 rounded border border-[var(--site-border-strong)] ${SITE_LOGO_BACKGROUND_CLASSES[background]}`} />{SITE_LOGO_BACKGROUND_LABELS[background]}</button>; })}</div></div>
      </SectionCard>
      <aside className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"><h2 className="font-bold">ตัวอย่างแบรนด์</h2><div className={`mt-4 rounded-md p-4 ${SITE_LOGO_BACKGROUND_CLASSES[draft.logoBackground]}`}><img alt={draft.logoImage.alt} className="mx-auto h-20 max-w-full object-contain" src={draft.logoImage.url} /></div><p className="mt-3 text-center text-sm font-semibold">{draft.siteName || "Pool Villas Pattaya"}</p></aside>
    </div> : null}
  </div>;
}
