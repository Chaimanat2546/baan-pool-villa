"use client";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import type { SiteSettings } from "@/lib/site-settings/types";

import { AssetUploadField } from "./asset-upload-field";
import { buildDraftThemeStyle, isHexColor } from "./settings-helpers";
import type { AdminSettingsDraft } from "./types";

interface SettingsFormProps {
  draft: AdminSettingsDraft;
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
  maxLength?: number;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}

interface SectionGroupProps {
  children: ReactNode;
  title: string;
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
  maxLength,
  multiline = false,
  onChange,
  placeholder,
  rows = 3,
  value,
}: TextControlProps) {
  return (
    <label className="block text-sm font-semibold text-[var(--site-text)]" htmlFor={id}>
      {label}
      {multiline ? (
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={id}
          maxLength={maxLength}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      ) : (
        <input
          className="mt-2 h-10 w-full rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={id}
          maxLength={maxLength}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          value={value}
        />
      )}
    </label>
  );
}

function SectionGroup({ children, title }: SectionGroupProps) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold text-[var(--site-text)]">{title}</h2>
      {children}
    </section>
  );
}

function getPreviewImageUrl(value: string, fallback: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
    return trimmedValue;
  }

  try {
    const url = new URL(trimmedValue);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function cssImageUrl(value: string): string {
  return `url("${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}")`;
}

export function SettingsForm({
  draft,
  onChange,
  onSave,
  settings,
}: SettingsFormProps) {
  const themeStyle = buildDraftThemeStyle(draft) as CSSProperties;
  const heroPreviewUrl = getPreviewImageUrl(
    settings.heroImage.url,
    "/images/BPV-66_Cover-Web.jpg",
  );
  const sharePreviewImageUrl = getPreviewImageUrl(
    draft.seoOgImageUrl,
    heroPreviewUrl,
  );

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

  function updateSameAsUrls(value: string) {
    onChange({
      seoSameAsUrls: value
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
    });
  }

  return (
    <form
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"
      onSubmit={handleSubmit}
    >
      <div className="grid content-start gap-6">
        <SectionGroup title="ตัวตนแบรนด์">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
            <TextControl
              id="siteName"
              label="ชื่อเว็บไซต์"
              onChange={(siteName) => {
                onChange({ siteName });
              }}
              placeholder="Pool Villas Pattaya"
              value={draft.siteName}
            />
          </div>
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
        </SectionGroup>

        <SectionGroup title="สีของเว็บ">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="h-12 rounded-md bg-[var(--site-primary)]" />
              <div className="h-12 rounded-md bg-[var(--site-primary-soft)]" />
              <div className="h-12 rounded-md bg-[var(--site-accent)]" />
            </div>
          </div>
        </SectionGroup>

        <SectionGroup title="รูปภาพหลัก">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
            <TextControl
              id="heroImageAlt"
              label="คำอธิบายรูปหน้าแรก"
              maxLength={160}
              onChange={(heroImageAlt) => {
                onChange({ heroImageAlt });
              }}
              placeholder="ภาพบ้านพักพูลวิลล่าที่พัทยา"
              value={draft.heroImageAlt}
            />
          </div>
          <AssetUploadField
            currentAlt={settings.heroImage.alt}
            currentLabel="รูปหน้าแรกปัจจุบัน"
            currentUrl={settings.heroImage.url}
            description="ใช้ภาพเดียวกันสำหรับ desktop และ mobile"
            id="heroFile"
            label="รูปหน้าแรก"
            onFileChange={(heroFile) => {
              onChange({ heroFile });
            }}
            selectedFile={draft.heroFile}
          />
        </SectionGroup>

        <SectionGroup title="ตอนแชร์ลิงก์และ Google">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <TextControl
                id="seoTitle"
                label="ชื่อหน้าที่แสดงบน Google"
                maxLength={80}
                onChange={(seoTitle) => {
                  onChange({ seoTitle });
                }}
                placeholder="Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา"
                value={draft.seoTitle}
              />
              <TextControl
                id="seoBusinessName"
                label="ชื่อร้านหรือชื่อธุรกิจ"
                maxLength={100}
                onChange={(seoBusinessName) => {
                  onChange({ seoBusinessName });
                }}
                placeholder="Pool Villas Pattaya"
                value={draft.seoBusinessName}
              />
              <TextControl
                id="seoDescription"
                label="คำอธิบายเว็บที่แสดงบน Google"
                maxLength={180}
                multiline
                onChange={(seoDescription) => {
                  onChange({ seoDescription });
                }}
                placeholder="รวมบ้านพักพูลวิลล่าพัทยา"
                value={draft.seoDescription}
              />
              <TextControl
                id="seoSameAsUrls"
                label="ลิงก์โซเชียลของร้าน"
                multiline
                onChange={updateSameAsUrls}
                placeholder="https://www.facebook.com/baanpoolvillas"
                value={draft.seoSameAsUrls.join("\n")}
              />
              <TextControl
                id="seoOgImageUrl"
                label="รูปตัวอย่างตอนแชร์ลิงก์"
                onChange={(seoOgImageUrl) => {
                  onChange({ seoOgImageUrl });
                }}
                placeholder="/images/BPV-66_Cover-Web.jpg"
                value={draft.seoOgImageUrl}
              />
              <TextControl
                id="seoOgImageAlt"
                label="คำอธิบายรูปตอนแชร์ลิงก์"
                maxLength={160}
                onChange={(seoOgImageAlt) => {
                  onChange({ seoOgImageAlt });
                }}
                placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
                value={draft.seoOgImageAlt}
              />
            </div>
          </div>
        </SectionGroup>

        <SectionGroup title="ข้อมูลชำระเงินและการติดต่อ">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
            <div className="grid gap-4 lg:grid-cols-3">
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

            <div className="mt-4 grid gap-4">
              {draft.phoneContacts.map((contact, index) => (
                <div
                  className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 lg:grid-cols-3"
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
        </SectionGroup>
      </div>

      <aside className="grid content-start gap-4 xl:sticky xl:top-4">
        <section
          className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]"
          style={themeStyle}
        >
          <div className="border-b border-[var(--site-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--site-text)]">
              ตัวอย่างหน้าเว็บ
            </h2>
          </div>
          <div className="grid gap-4 p-4">
            <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
              <div
                className="h-32 bg-cover bg-center"
                style={{ backgroundImage: cssImageUrl(heroPreviewUrl) }}
              />
              <div className="p-3">
                <p className="text-lg font-semibold text-[var(--site-text)]">
                  {draft.siteName || "Pool Villas Pattaya"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                    ดูบ้านพัก
                  </span>
                  <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary-soft)] px-3 text-sm font-semibold text-[var(--site-text)]">
                    ติดต่อเรา
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--site-border)] bg-white p-3">
              <p className="text-xs text-[#4d5156]">baanpoolvilla.example</p>
              <h3 className="mt-1 line-clamp-2 text-base font-medium text-[#1a0dab]">
                {draft.seoTitle || draft.siteName}
              </h3>
              <p className="mt-1 line-clamp-3 text-sm leading-5 text-[#4d5156]">
                {draft.seoDescription}
              </p>
              <p className="mt-3 text-xs font-semibold text-[var(--site-muted)]">
                ตัวอย่างผลค้นหา Google
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-white">
              <div
                className="h-36 bg-cover bg-center"
                style={{ backgroundImage: cssImageUrl(sharePreviewImageUrl) }}
              />
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-[#050505]">
                  {draft.seoTitle || draft.siteName}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#65676b]">
                  {draft.seoDescription}
                </p>
                <p className="mt-3 text-xs font-semibold text-[var(--site-muted)]">
                  ตัวอย่างตอนแชร์ลิงก์
                </p>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </form>
  );
}
