"use client";

import { Save } from "lucide-react";
import type { CSSProperties, FormEvent } from "react";

import type { SiteSettings } from "@/lib/site-settings/types";

import { AssetUploadField } from "./asset-upload-field";
import { buildDraftThemeStyle, isHexColor } from "./settings-helpers";
import type { AdminSettingsDraft } from "./types";

interface SettingsFormProps {
  draft: AdminSettingsDraft;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onChange: (changes: Partial<AdminSettingsDraft>) => void;
  onSave: () => Promise<void>;
  settings: SiteSettings;
}

interface ColorControlProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

function ColorControl({ id, label, onChange, value }: ColorControlProps) {
  const trimmedValue = value.trim();
  const colorPickerValue = isHexColor(trimmedValue) ? trimmedValue : "#000000";

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-[#173f36]" htmlFor={id}>
        {label}
      </label>
      <div className="grid grid-cols-[48px_1fr] gap-2">
        <input
          aria-label={`${label} ตัวเลือกสี`}
          className="h-10 w-12 rounded-md border border-[#c9d9d3] bg-white p-1"
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          type="color"
          value={colorPickerValue}
        />
        <input
          className="h-10 min-w-0 rounded-md border border-[#c9d9d3] bg-white px-3 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
          id={id}
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          placeholder="#064e3b"
          value={trimmedValue}
        />
      </div>
    </div>
  );
}

export function SettingsForm({
  draft,
  hasUnsavedChanges,
  isSaving,
  onChange,
  onSave,
  settings,
}: SettingsFormProps) {
  const themeStyle = buildDraftThemeStyle(draft) as CSSProperties;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave();
  }

  return (
    <form className="grid gap-4 xl:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
      <div className="grid content-start gap-4">
        <section className="rounded-[24px] border border-[#dbe7e3] bg-white p-4 shadow-[0_12px_34px_rgba(6,63,53,0.06)]">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-[#173f36]">
              ชื่อเว็บไซต์
              <input
                className="mt-2 h-10 w-full rounded-lg border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                onChange={(event) => {
                  onChange({ siteName: event.target.value });
                }}
                placeholder="Pool Villas Pattaya"
                value={draft.siteName}
              />
            </label>

            <label className="block text-sm font-semibold text-[#173f36]">
              คำอธิบายรูป Hero (Alt text)
              <input
                className="mt-2 h-10 w-full rounded-lg border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
                maxLength={160}
                onChange={(event) => {
                  onChange({ heroImageAlt: event.target.value });
                }}
                placeholder="ภาพโรงแรมพูลวิลล่าที่พัทยา"
                value={draft.heroImageAlt}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#dbe7e3] bg-white p-4 shadow-[0_12px_34px_rgba(6,63,53,0.06)]">
          <div className="grid gap-4 lg:grid-cols-2">
            <ColorControl
              id="primaryColor"
              label="สีหลัก"
              onChange={(primaryColor) => {
                onChange({ primaryColor });
              }}
              value={draft.primaryColor}
            />
            <ColorControl
              id="accentColor"
              label="สีเน้น"
              onChange={(accentColor) => {
                onChange({ accentColor });
              }}
              value={draft.accentColor}
            />
          </div>
        </section>

        <AssetUploadField
          currentAlt={settings.logoImage.alt}
          currentLabel="โลโก้ปัจจุบัน"
          currentUrl={settings.logoImage.url}
          description="ไฟล์ PNG / JPG / WebP สำหรับโลโก้หน้าเว็บ"
          id="logoFile"
          label="โลโก้"
          onFileChange={(logoFile) => {
            onChange({ logoFile });
          }}
          selectedFile={draft.logoFile}
        />

        <AssetUploadField
          currentAlt={settings.heroImage.alt}
          currentLabel="Hero ปัจจุบัน"
          currentUrl={settings.heroImage.url}
          description="ใช้ภาพเดียวกันสำหรับ desktop และ mobile"
          id="heroFile"
          label="รูป Hero"
          onFileChange={(heroFile) => {
            onChange({ heroFile });
          }}
          selectedFile={draft.heroFile}
        />
      </div>

      <aside className="grid content-start gap-4">
        <section
          className="overflow-hidden rounded-[24px] border border-[#dbe7e3] bg-white shadow-[0_12px_34px_rgba(6,63,53,0.06)]"
          style={themeStyle}
        >
          <div className="bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)]">
            <p className="text-xs font-semibold text-[var(--site-accent)]">
              ตัวอย่างธีม
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-normal">
              {draft.siteName || "ชื่อเว็บไซต์"}
            </h2>
          </div>
          <div className="grid gap-3 p-4">
            <div className="rounded-md bg-[var(--site-primary-soft)] p-3">
              <p className="text-sm font-semibold text-[var(--site-primary)]">
                พื้นหลังสีหลัก
              </p>
              <p className="mt-1 text-xs text-[#506862]">
                {draft.primaryColor}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                ปุ่มสีหลัก
              </span>
              <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-accent-soft)] px-3 text-sm font-semibold text-[#3f3420]">
                ปุ่มเน้น {draft.accentColor}
              </span>
            </div>
          </div>
        </section>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !hasUnsavedChanges}
          type="submit"
        >
          <Save aria-hidden="true" className="size-4" />
          {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </aside>
    </form>
  );
}
