"use client";

import { Search } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { validateUploadMetadata } from "@/lib/site-settings/validation";
import { AssetUploadField } from "./asset-upload-field";
import { SectionCard, TextControl } from "./settings-form-controls";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { buildSeoSettingsFormData, formatDelimitedValues, getSafePreviewImageUrl, makeSeoSettingsSnapshot, mapSeoSettingsResponse, parseDelimitedValues } from "./settings-helpers";
import { validateSeoSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";

export function SeoSettingsPage() {
  const state = useAdminSettingsSection({ section: "seo", mapResponse: mapSeoSettingsResponse, makeSnapshot: makeSeoSettingsSnapshot, buildRequest: (draft) => ({ body: buildSeoSettingsFormData(draft) }), validate: validateSeoSettingsDraft });
  const { draft } = state;
  const heroFallback = "/images/BPV-66_Cover-Web.jpg";
  const previewUrl = draft ? getSafePreviewImageUrl(draft.seoOgImageUrl, heroFallback) : heroFallback;
  return <div className="grid gap-5">
    <SettingsSectionHeader title="SEO และการแชร์" description="กำหนดข้อความที่เครื่องมือค้นหาและโซเชียลเห็นเมื่อมีคนค้นหาหรือแชร์ลิงก์เว็บไซต์" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <SectionCard description="กำหนดข้อมูลที่แสดงบน Google และตอนแชร์ลิงก์" icon={<Search aria-hidden="true" className="size-5" />} id="seo" title="SEO และการแชร์">
        <div className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 lg:grid-cols-2">
          <TextControl id="seoTitle" label="ชื่อหน้าบน Google" maxLength={80} value={draft.seoTitle} onChange={(seoTitle) => state.updateDraft({ seoTitle })} />
          <TextControl id="seoBusinessName" label="ชื่อธุรกิจ" maxLength={100} value={draft.seoBusinessName} onChange={(seoBusinessName) => state.updateDraft({ seoBusinessName })} />
        </div>
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><h3 className="mb-4 font-semibold">SEO หน้าแรก</h3><div className="grid gap-4 lg:grid-cols-2">
          <TextControl id="seoDescription" label="คำอธิบายเว็บไซต์" maxLength={180} multiline rows={5} value={draft.seoDescription} onChange={(seoDescription) => state.updateDraft({ seoDescription })} />
          <TextControl id="seoKeywords" label="Keywords SEO" multiline rows={5} value={formatDelimitedValues(draft.seoKeywords)} onChange={(value) => state.updateDraft({ seoKeywords: parseDelimitedValues(value) })} />
          <TextControl id="seoSameAsUrls" label="ลิงก์โซเชียลของเว็บไซต์" multiline rows={5} value={formatDelimitedValues(draft.seoSameAsUrls)} onChange={(value) => state.updateDraft({ seoSameAsUrls: parseDelimitedValues(value) })} />
          <div className="lg:col-span-2"><AssetUploadField currentAlt={draft.seo.ogImage.alt} currentLabel="รูปแชร์หน้าแรกปัจจุบัน" currentUrl={draft.seo.ogImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับภาพที่ใช้ตอนแชร์ลิงก์หน้าแรก" id="seoOgImageFile" label="รูปแชร์ลิงก์หน้าแรก" selectedFile={draft.seoOgImageFile} onFileChange={(seoOgImageFile) => state.updateDraft({ seoOgImageFile })} validateFile={(file) => validateUploadMetadata("seo-og", file.type, file.size, file.name)} /></div>
          <TextControl id="seoOgImageAlt" label="คำอธิบายรูปแชร์ลิงก์" maxLength={160} value={draft.seoOgImageAlt} onChange={(seoOgImageAlt) => state.updateDraft({ seoOgImageAlt })} />
        </div></div>
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><h3 className="mb-4 font-semibold">SEO หน้าค้นหา</h3><div className="grid gap-4 lg:grid-cols-2">
          <TextControl id="searchSeoTitle" label="ชื่อหน้า" maxLength={80} value={draft.searchSeoTitle} onChange={(searchSeoTitle) => state.updateDraft({ searchSeoTitle })} />
          <TextControl id="searchSeoDescription" label="คำอธิบาย" maxLength={180} multiline value={draft.searchSeoDescription} onChange={(searchSeoDescription) => state.updateDraft({ searchSeoDescription })} />
          <TextControl id="searchSeoKeywords" label="คำค้น" multiline value={formatDelimitedValues(draft.searchSeoKeywords)} onChange={(value) => state.updateDraft({ searchSeoKeywords: parseDelimitedValues(value) })} />
          <div className="lg:col-span-2"><AssetUploadField currentAlt={draft.pageSeo.search.ogImage.alt} currentLabel="รูปแชร์หน้าค้นหาปัจจุบัน" currentUrl={draft.pageSeo.search.ogImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับหน้าค้นหา" id="searchSeoOgImageFile" label="รูปแชร์ลิงก์หน้าค้นหา" selectedFile={draft.searchSeoOgImageFile} onFileChange={(searchSeoOgImageFile) => state.updateDraft({ searchSeoOgImageFile })} validateFile={(file) => validateUploadMetadata("search-seo-og", file.type, file.size, file.name)} /></div>
          <TextControl id="searchSeoOgImageAlt" label="คำอธิบายรูป" maxLength={160} value={draft.searchSeoOgImageAlt} onChange={(searchSeoOgImageAlt) => state.updateDraft({ searchSeoOgImageAlt })} />
        </div></div>
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><h3 className="mb-4 font-semibold">SEO หน้าบทความ</h3><div className="grid gap-4 lg:grid-cols-2">
          <TextControl id="guidesSeoTitle" label="ชื่อหน้า" maxLength={80} value={draft.guidesSeoTitle} onChange={(guidesSeoTitle) => state.updateDraft({ guidesSeoTitle })} />
          <TextControl id="guidesSeoDescription" label="คำอธิบาย" maxLength={180} multiline value={draft.guidesSeoDescription} onChange={(guidesSeoDescription) => state.updateDraft({ guidesSeoDescription })} />
          <TextControl id="guidesSeoKeywords" label="คำค้น" multiline value={formatDelimitedValues(draft.guidesSeoKeywords)} onChange={(value) => state.updateDraft({ guidesSeoKeywords: parseDelimitedValues(value) })} />
          <div className="lg:col-span-2"><AssetUploadField currentAlt={draft.pageSeo.guides.ogImage.alt} currentLabel="รูปแชร์หน้าบทความปัจจุบัน" currentUrl={draft.pageSeo.guides.ogImage.url} description="ไฟล์ PNG / JPG / WebP สำหรับหน้าบทความ" id="guidesSeoOgImageFile" label="รูปแชร์ลิงก์หน้าบทความ" selectedFile={draft.guidesSeoOgImageFile} onFileChange={(guidesSeoOgImageFile) => state.updateDraft({ guidesSeoOgImageFile })} validateFile={(file) => validateUploadMetadata("guides-seo-og", file.type, file.size, file.name)} /></div>
          <TextControl id="guidesSeoOgImageAlt" label="คำอธิบายรูป" maxLength={160} value={draft.guidesSeoOgImageAlt} onChange={(guidesSeoOgImageAlt) => state.updateDraft({ guidesSeoOgImageAlt })} />
        </div></div>
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><h3 className="mb-4 font-semibold">SEO หน้ารายละเอียดบ้าน</h3><TextControl id="villaDetailSeoKeywords" label="Keywords SEO" multiline value={formatDelimitedValues(draft.villaDetailSeoKeywords)} onChange={(value) => state.updateDraft({ villaDetailSeoKeywords: parseDelimitedValues(value) })} /></div>
      </SectionCard>
      <aside className="grid content-start gap-5"><div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"><h2 className="font-bold">ตัวอย่างบน Google</h2><p className="mt-4 text-lg text-blue-700">{draft.seoTitle}</p><p className="text-sm text-green-700">baanpoolvilla.com</p><p className="mt-1 text-sm text-[var(--site-muted)]">{draft.seoDescription}</p></div><div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"><div className="relative h-40"><Image alt={draft.seoOgImageAlt || draft.seo.ogImage.alt} fill className="object-cover" src={previewUrl} /></div><div className="p-4"><p className="font-bold">{draft.seoTitle}</p><p className="mt-1 text-sm text-[var(--site-muted)]">{draft.seoDescription}</p></div></div></aside>
    </div> : null}
  </div>;
}
