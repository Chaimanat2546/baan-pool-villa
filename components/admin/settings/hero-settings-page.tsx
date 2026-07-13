"use client";

import { LayoutTemplate } from "lucide-react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { validateUploadMetadata } from "@/lib/site-settings/validation";
import { AssetUploadField } from "./asset-upload-field";
import { SectionCard, TextControl } from "./settings-form-controls";
import { buildHeroSettingsFormData, getSafePreviewImageUrl, makeHeroSettingsSnapshot, mapHeroSettingsResponse } from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { validateHeroSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";

export function HeroSettingsPage() {
  const state = useAdminSettingsSection({ section: "hero", mapResponse: mapHeroSettingsResponse, makeSnapshot: makeHeroSettingsSnapshot, buildRequest: (draft) => ({ body: buildHeroSettingsFormData(draft) }), validate: validateHeroSettingsDraft });
  const { draft } = state;
  const previewUrl = draft ? getSafePreviewImageUrl(draft.heroImage.url, "/images/BPV-66_Cover-Web.jpg") : "";
  return <div className="grid gap-5">
    <SettingsSectionHeader title="รูปหลัก" description="จัดการภาพหลักของหน้าแรกและคำอธิบายรูปที่ใช้กับภาพเดียวกันทั้งเดสก์ท็อปและมือถือ" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <SectionCard description="ภาพหลักและคำอธิบายหน้าแรก" icon={<LayoutTemplate aria-hidden="true" className="size-5" />} id="hero" title="รูปหลัก">
        <TextControl id="heroImageAlt" label="คำอธิบายรูปหน้าแรก" description="ใช้เป็นข้อความอธิบายรูปสำหรับการเข้าถึงและกรณีโหลดรูปไม่สำเร็จ" maxLength={160} placeholder="ภาพบ้านพักพูลวิลล่าที่พัทยา" value={draft.heroImageAlt} onChange={(heroImageAlt) => state.updateDraft({ heroImageAlt })} />
        <AssetUploadField currentAlt={draft.heroImage.alt} currentLabel="รูปหน้าแรกปัจจุบัน" currentUrl={draft.heroImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับรูปหลักหน้าแรก แนะนำขนาด 1200x800px ขึ้นไป" id="heroFile" label="รูปหน้าแรก" selectedFile={draft.heroFile} onFileChange={(heroFile) => state.updateDraft({ heroFile })} validateFile={(file) => validateUploadMetadata("hero", file.type, file.size, file.name)} />
      </SectionCard>
      <aside className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"><div className="border-b p-4"><h2 className="font-bold">ตัวอย่างหน้าเว็บ</h2></div><div className="relative h-48"><Image alt={draft.heroImageAlt || draft.heroImage.alt} className="object-cover" fill sizes="320px" src={previewUrl} /></div><p className="p-4 text-sm text-[var(--site-muted)]">{draft.heroImageAlt}</p></aside>
    </div> : null}
  </div>;
}
