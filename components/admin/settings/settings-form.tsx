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

interface TextControlProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

function ColorControl({ id, label, onChange, value }: ColorControlProps) {
  const trimmedValue = value.trim();
  const colorPickerValue = isHexColor(trimmedValue) ? trimmedValue : "#000000";

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-[var(--site-text)]" htmlFor={id}>
        {label}
      </label>
      <div className="grid grid-cols-[48px_1fr] gap-2">
        <input
          aria-label={`${label} ตัวเลือกสี`}
          className="h-10 w-12 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-1"
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          type="color"
          value={colorPickerValue}
        />
        <input
          className="h-10 min-w-0 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 font-mono text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
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

function TextControl({
  id,
  label,
  onChange,
  placeholder,
  value,
}: TextControlProps) {
  return (
    <label className="block text-sm font-semibold text-[var(--site-text)]" htmlFor={id}>
      {label}
      <input
        className="mt-2 h-10 w-full rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
        id={id}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        value={value}
      />
    </label>
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

  function updatePhoneContact(
    index: number,
    changes: Partial<AdminSettingsDraft["phoneContacts"][number]>,
  ) {
    onChange({
      phoneContacts: draft.phoneContacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, ...changes } : contact,
      ),
    });
  }

  return (
    <form className="grid gap-4 xl:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
      <div className="grid content-start gap-4">
        <section className="rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--site-text)]">
              ชื่อเว็บไซต์
              <input
                className="mt-2 h-10 w-full rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                onChange={(event) => {
                  onChange({ siteName: event.target.value });
                }}
                placeholder="Pool Villas Pattaya"
                value={draft.siteName}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--site-text)]">
              คำอธิบายรูป Hero (Alt text)
              <input
                className="mt-2 h-10 w-full rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
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

        <section className="rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
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

        <section className="rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-[var(--site-text)]">
              ข้อมูลบัญชีธนาคาร
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <TextControl
                id="bankAccountName"
                label="ชื่อบัญชี"
                onChange={(bankAccountName) => {
                  onChange({ bankAccountName });
                }}
                placeholder="คุณ อาภัสรา จินดาวา"
                value={draft.bankAccountName}
              />
              <TextControl
                id="bankName"
                label="ชื่อธนาคาร"
                onChange={(bankName) => {
                  onChange({ bankName });
                }}
                placeholder="ธนาคารกสิกรไทย"
                value={draft.bankName}
              />
              <TextControl
                id="bankAccountNumber"
                label="เลขบัญชี"
                onChange={(bankAccountNumber) => {
                  onChange({ bankAccountNumber });
                }}
                placeholder="398-289-7482"
                value={draft.bankAccountNumber}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-[var(--site-text)]">
              ช่องทางติดต่อ
            </h2>
            <div className="mt-4 grid gap-4">
              {draft.phoneContacts.map((contact, index) => (
                <div
                  className="grid gap-4 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 lg:grid-cols-3"
                  key={index}
                >
                  <TextControl
                    id={`phoneContactName-${index}`}
                    label={`ชื่อผู้ติดต่อ ${index + 1}`}
                    onChange={(name) => {
                      updatePhoneContact(index, { name });
                    }}
                    placeholder="คุณเกม"
                    value={contact.name}
                  />
                  <TextControl
                    id={`phoneContactPhone-${index}`}
                    label={`เบอร์โทร ${index + 1}`}
                    onChange={(phone) => {
                      updatePhoneContact(index, { phone });
                    }}
                    placeholder="0617485213"
                    value={contact.phone}
                  />
                  <TextControl
                    id={`phoneContactTime-${index}`}
                    label={`ช่วงเวลา ${index + 1}`}
                    onChange={(time) => {
                      updatePhoneContact(index, { time });
                    }}
                    placeholder="ช่วง 07.00-15.00"
                    value={contact.time}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <TextControl
                id="messengerUrl"
                label="ลิงก์ Messenger"
                onChange={(messengerUrl) => {
                  onChange({ messengerUrl });
                }}
                placeholder="https://www.facebook.com/baanpoolvillas"
                value={draft.messengerUrl}
              />
              <TextControl
                id="lineId"
                label="LINE ID"
                onChange={(lineId) => {
                  onChange({ lineId });
                }}
                placeholder="@baanpoolvilla"
                value={draft.lineId}
              />
              <TextControl
                id="lineUrl"
                label="ลิงก์ LINE"
                onChange={(lineUrl) => {
                  onChange({ lineUrl });
                }}
                placeholder="https://line.me/R/ti/p/@baanpoolvilla"
                value={draft.lineUrl}
              />
            </div>
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
          className="overflow-hidden rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"
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
              <p className="mt-1 text-xs text-[var(--site-muted)]">
                {draft.primaryColor}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                ปุ่มสีหลัก
              </span>
              <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-accent-soft)] px-3 text-sm font-semibold text-[var(--site-text)]">
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
