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
  const previewUrl = draft ? getSafePreviewImageUrl(draft.seoOgImageUrl, "/images/BPV-66_Cover-Web.jpg") : "/images/BPV-66_Cover-Web.jpg";

  return (
    <div className="grid gap-5">
      <SettingsSectionHeader title="SEO และการแชร์" description="กำหนดข้อความที่เครื่องมือค้นหาและโซเชียลเห็นเมื่อมีคนค้นหาหรือแชร์ลิงก์เว็บไซต์" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
      <AdminFeedback errors={state.errors} notice={state.notice} warnings={state.warnings} />
      {state.isLoading ? <SettingsSectionSkeleton /> : draft ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard
          description="กำหนดข้อความที่เครื่องมือค้นหาและโซเชียลเห็นเมื่อมีคนค้นหาหรือแชร์ลิงก์เว็บไซต์"
          icon={<Search aria-hidden="true" className="size-5" />}
          id="seo"
          title="SEO และการแชร์"
        >
          <div className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 lg:grid-cols-2">
            <TextControl
              description="ชื่อที่แสดงในผลการค้นหา"
              id="seoTitle"
              label="ชื่อหน้าบน Google"
              maxLength={80}
              onChange={(seoTitle) => {
                state.updateDraft({ seoTitle });
              }}
              placeholder="Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา"
              value={draft.seoTitle}
            />
            <TextControl
              description="ชื่อธุรกิจสำหรับข้อมูลโครงสร้างและการอ้างอิง"
              id="seoBusinessName"
              label="ชื่อธุรกิจ"
              maxLength={100}
              onChange={(seoBusinessName) => {
                state.updateDraft({ seoBusinessName });
              }}
              placeholder="Pool Villas Pattaya"
              value={draft.seoBusinessName}
            />
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้าแรก
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                ตั้งค่าคำอธิบาย และรูปแชร์ลิงก์สำหรับหน้าแรก
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            <TextControl
              id="seoDescription"
              label="คำอธิบายเว็บไซต์"
              maxLength={180}
              rows={5}
              multiline
              onChange={(seoDescription) => {
                state.updateDraft({ seoDescription });
              }}
              placeholder="รวมบ้านพักพูลวิลล่าพัทยา"
              value={draft.seoDescription}
            />
            <TextControl
              id="seoKeywords"
              label="Keywords SEO"
              multiline
              onChange={(value) => {
                state.updateDraft({ seoKeywords: parseDelimitedValues(value) });
              }}
              placeholder="บ้านพักพูลวิลล่า,พูลวิลล่าพัทยา,บ้านพักสระส่วนตัว"
              rows={5}
              value={formatDelimitedValues(draft.seoKeywords)}
            />
            <TextControl
              id="seoSameAsUrls"
              label="ลิงก์โซเชียลของเว็บไซต์"
              multiline
              rows={5}
              onChange={(value) => state.updateDraft({ seoSameAsUrls: parseDelimitedValues(value) })}
              placeholder="https://www.facebook.com/baanpoolvillas,https://line.me/R/ti/p/@baanpoolvilla"
              value={formatDelimitedValues(draft.seoSameAsUrls)}
            />
            <div className="lg:col-span-2">
              <AssetUploadField
                currentAlt={draft.seo.ogImage.alt}
                currentLabel="รูปแชร์หน้าแรกปัจจุบัน"
                currentUrl={draft.seo.ogImage.url}
                description="ไฟล์ PNG / JPG / WebP สำหรับภาพที่ใช้ตอนแชร์ลิงก์หน้าแรก"
                id="seoOgImageFile"
                label="รูปแชร์ลิงก์หน้าแรก"
                onFileChange={(seoOgImageFile) => {
                  state.updateDraft({ seoOgImageFile });
                }}
                selectedFile={draft.seoOgImageFile}
                validateFile={(file) => {
                  return validateUploadMetadata(
                    "seo-og",
                    file.type,
                    file.size,
                    file.name,
                  );
                }}
              />
            </div>
            <TextControl
              id="seoOgImageAlt"
              label="คำอธิบายรูปแชร์ลิงก์"
              maxLength={160}
              onChange={(seoOgImageAlt) => {
                state.updateDraft({ seoOgImageAlt });
              }}
              placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
              value={draft.seoOgImageAlt}
            />
          </div>
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้าค้นหา
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                ตั้งค่าชื่อหน้า คำอธิบาย และรูปแชร์ลิงก์สำหรับหน้าค้นหาโดยเฉพาะ
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextControl
                id="searchSeoTitle"
                label="ชื่อหน้า"
                maxLength={80}
                onChange={(searchSeoTitle) => {
                  state.updateDraft({ searchSeoTitle });
                }}
                placeholder="ค้นหาบ้านพักพูลวิลล่าพัทยา"
                value={draft.searchSeoTitle}
              />
              <div className="lg:col-span-2">
                <AssetUploadField
                  currentAlt={draft.pageSeo.search.ogImage.alt}
                  currentLabel="รูปแชร์หน้าค้นหาปัจจุบัน"
                  currentUrl={draft.pageSeo.search.ogImage.url}
                  description="ไฟล์ PNG / JPG / WebP สำหรับภาพที่ใช้ตอนแชร์ลิงก์หน้าค้นหา"
                  id="searchSeoOgImageFile"
                  label="รูปแชร์ลิงก์หน้าค้นหา"
                  onFileChange={(searchSeoOgImageFile) => {
                    state.updateDraft({ searchSeoOgImageFile });
                  }}
                  selectedFile={draft.searchSeoOgImageFile}
                  validateFile={(file) => {
                    return validateUploadMetadata(
                      "search-seo-og",
                      file.type,
                      file.size,
                      file.name,
                    );
                  }}
                />
              </div>
              <TextControl
                id="searchSeoDescription"
                label="คำอธิบาย"
                maxLength={180}
                multiline
                onChange={(searchSeoDescription) => {
                  state.updateDraft({ searchSeoDescription });
                }}
                placeholder="ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน และราคา"
                value={draft.searchSeoDescription}
              />
              <TextControl
                id="searchSeoKeywords"
                label="คำค้น"
                multiline
                onChange={(value) => {
                  state.updateDraft({ searchSeoKeywords: parseDelimitedValues(value) });
                }}
                placeholder="ค้นหาพูลวิลล่าพัทยา,พูลวิลล่าตามจำนวนคน"
                rows={4}
                value={formatDelimitedValues(draft.searchSeoKeywords)}
              />
              <TextControl
                id="searchSeoOgImageAlt"
                label="คำอธิบายรูป"
                maxLength={160}
                onChange={(searchSeoOgImageAlt) => {
                  state.updateDraft({ searchSeoOgImageAlt });
                }}
                placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
                value={draft.searchSeoOgImageAlt}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้าบทความ
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                ตั้งค่าชื่อหน้า คำอธิบาย และรูปแชร์ลิงก์สำหรับหน้ารวมบทความ
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextControl
                id="guidesSeoTitle"
                label="ชื่อหน้า"
                maxLength={80}
                onChange={(guidesSeoTitle) => {
                  state.updateDraft({ guidesSeoTitle });
                }}
                placeholder="บทความแนะนำบ้านพักพูลวิลล่าพัทยา"
                value={draft.guidesSeoTitle}
              />
              <div className="lg:col-span-2">
                <AssetUploadField
                  currentAlt={draft.pageSeo.guides.ogImage.alt}
                  currentLabel="รูปแชร์หน้าบทความปัจจุบัน"
                  currentUrl={draft.pageSeo.guides.ogImage.url}
                  description="ไฟล์ PNG / JPG / WebP สำหรับภาพที่ใช้ตอนแชร์ลิงก์หน้าบทความ"
                  id="guidesSeoOgImageFile"
                  label="รูปแชร์ลิงก์หน้าบทความ"
                  onFileChange={(guidesSeoOgImageFile) => {
                    state.updateDraft({ guidesSeoOgImageFile });
                  }}
                  selectedFile={draft.guidesSeoOgImageFile}
                  validateFile={(file) => {
                    return validateUploadMetadata(
                      "guides-seo-og",
                      file.type,
                      file.size,
                      file.name,
                    );
                  }}
                />
              </div>
              <TextControl
                id="guidesSeoDescription"
                label="คำอธิบาย"
                maxLength={180}
                multiline
                onChange={(guidesSeoDescription) => {
                  state.updateDraft({ guidesSeoDescription });
                }}
                placeholder="บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว"
                value={draft.guidesSeoDescription}
              />
              <TextControl
                id="guidesSeoKeywords"
                label="คำค้น"
                multiline
                onChange={(value) => {
                  state.updateDraft({ guidesSeoKeywords: parseDelimitedValues(value) });
                }}
                placeholder="บทความพูลวิลล่าพัทยา,คู่มือเลือกพูลวิลล่า"
                rows={4}
                value={formatDelimitedValues(draft.guidesSeoKeywords)}
              />
              <TextControl
                id="guidesSeoOgImageAlt"
                label="คำอธิบายรูป"
                maxLength={160}
                onChange={(guidesSeoOgImageAlt) => {
                  state.updateDraft({ guidesSeoOgImageAlt });
                }}
                placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
                value={draft.guidesSeoOgImageAlt}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้ารายละเอียดบ้าน
              </h3>
            </div>
            <TextControl
              id="villaDetailSeoKeywords"
              label="Keywords SEO"
              multiline
              onChange={(value) => {
                state.updateDraft({
                  villaDetailSeoKeywords: parseDelimitedValues(value),
                });
              }}
              placeholder="รายละเอียดพูลวิลล่าพัทยา,จองพูลวิลล่าพัทยา"
              rows={4}
              value={formatDelimitedValues(draft.villaDetailSeoKeywords)}
            />
          </div>
        </SectionCard>
          <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36"><section className="rounded-lg border border-[var(--site-border)] bg-white p-4 shadow-sm"><p className="text-xs text-[#4d5156]">baanpoolvilla.example</p><h3 className="mt-1 line-clamp-2 text-base font-medium text-[#1a0dab]">{draft.seoTitle}</h3><p className="mt-1 line-clamp-3 text-sm leading-5 text-[#4d5156]">{draft.seoDescription}</p><p className="mt-3 text-xs font-semibold text-[var(--site-muted)]">ตัวอย่างผลค้นหา Google</p></section><section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-white shadow-sm"><div className="relative h-36 overflow-hidden"><Image alt={draft.seoOgImageAlt || draft.seo.ogImage.alt} className="object-cover" fill loading="eager" sizes="360px" src={previewUrl} /></div><div className="p-4"><p className="line-clamp-2 text-sm font-semibold text-[#050505]">{draft.seoTitle}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#65676b]">{draft.seoDescription}</p><p className="mt-3 text-xs font-semibold text-[var(--site-muted)]">ตัวอย่างตอนแชร์ลิงก์</p></div></section></aside>
        </div>
      ) : null}
    </div>
  );
}
