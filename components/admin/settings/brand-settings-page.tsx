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
        <TextControl id="siteName" label="ชื่อเว็บไซต์" description="ชื่อนี้จะใช้เป็นชื่อหลักของเว็บไซต์" placeholder="Pool Villas Pattaya" value={draft.siteName} onChange={(siteName) => state.updateDraft({ siteName })} />
        <AssetUploadField currentAlt={draft.logoImage.alt} currentLabel="โลโก้ปัจจุบัน" currentUrl={draft.logoImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับโลโก้หน้าเว็บ" id="logoFile" label="โลโก้" selectedFile={draft.logoFile} onFileChange={(logoFile) => state.updateDraft({ logoFile })} validateFile={(file) => validateUploadMetadata("logo", file.type, file.size, file.name)} />
        <AssetUploadField currentAlt={draft.faviconImage.alt} currentLabel="ไอคอนปัจจุบัน" currentUrl={draft.faviconImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับไอคอนแท็บเบราว์เซอร์และไอคอนบนมือถือ" id="faviconFile" label="ไอคอนเว็บไซต์" selectedFile={draft.faviconFile} onFileChange={(faviconFile) => state.updateDraft({ faviconFile })} validateFile={(file) => validateUploadMetadata("favicon", file.type, file.size, file.name)} />
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><p className="text-sm font-semibold">พื้นหลังโลโก้</p><p className="mt-1 text-xs text-[var(--site-muted)]">ใช้กับโลโก้ใน Header และ Footer เมื่อไฟล์โลโก้ไม่มีพื้นหลัง</p><div className="mt-3 grid gap-2 sm:grid-cols-4">{SITE_LOGO_BACKGROUNDS.map((background) => <button aria-pressed={draft.logoBackground === background} className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-left text-sm font-semibold" key={background} onClick={() => state.updateDraft({ logoBackground: background })} type="button"><span className={`mb-2 block h-8 rounded border ${SITE_LOGO_BACKGROUND_CLASSES[background]}`} />{SITE_LOGO_BACKGROUND_LABELS[background]}</button>)}</div></div>
      </SectionCard>
      <aside className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"><h2 className="font-bold">สรุปแบรนด์</h2><p className="mt-3 text-sm font-semibold">{draft.siteName || "ยังไม่ได้ระบุ"}</p><p className="mt-2 truncate text-xs text-[var(--site-muted)]">{draft.logoFile?.name ?? "ยังไม่ได้เลือกโลโก้ใหม่"}</p><p className="mt-1 truncate text-xs text-[var(--site-muted)]">{draft.faviconFile?.name ?? "ยังไม่ได้เลือกไอคอนใหม่"}</p></aside>
    </div> : null}
  </div>;
}
