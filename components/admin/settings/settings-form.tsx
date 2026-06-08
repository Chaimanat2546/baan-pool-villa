"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  BadgeInfo,
  Building2,
  Landmark,
  LayoutTemplate,
  Link2,
  MessageCircleMore,
  Palette,
  Search,
  ShieldCheck,
} from "lucide-react";

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
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

interface TextControlProps {
  description?: string;
  id: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}

interface SectionCardProps {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  id: string;
  title: string;
}

interface SectionNavItem {
  description: string;
  id: string;
  label: string;
}

const SECTION_NAV_ITEMS: SectionNavItem[] = [
  {
    description: "ชื่อเว็บ โลโก้ และภาพรวมแบรนด์",
    id: "identity",
    label: "ข้อมูลแบรนด์",
  },
  {
    description: "โทนหลักของหน้าเว็บและปุ่ม",
    id: "theme",
    label: "สีและธีม",
  },
  {
    description: "ภาพหลักและคำอธิบายหน้าแรก",
    id: "hero",
    label: "รูปหลัก",
  },
  {
    description: "ข้อมูลที่แสดงบน Google และตอนแชร์ลิงก์",
    id: "seo",
    label: "SEO และการแชร์",
  },
  {
    description: "ช่องทางติดต่อและข้อมูลชำระเงิน",
    id: "contact",
    label: "ติดต่อและชำระเงิน",
  },
];

/**
 * Render a labeled color picker paired with a textual hex input for editing a color value.
 *
 * Renders a color input and a text input side-by-side; the color input reflects a valid trimmed
 * hex value or `#000000` as a fallback, and either control updates the value via `onChange`.
 *
 * @param id - DOM id applied to the text input and its label
 * @param label - Visible label text for the control
 * @param description - Optional descriptive text shown beneath the label
 * @param value - Current color string; will be trimmed before display and when sent to `onChange`
 * @param onChange - Called with the trimmed string value when either input changes
 */
function ColorControl({
  description,
  id,
  label,
  onChange,
  value,
}: ColorControlProps) {
  const trimmedValue = value.trim();
  const colorPickerValue = isHexColor(trimmedValue) ? trimmedValue : "#000000";

  return (
    <div className="grid gap-2">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-[var(--site-text)]" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p className="text-xs leading-5 text-[var(--site-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-[52px_1fr] gap-3">
        <input
          aria-label={`${label} ตัวเลือกสี`}
          className="h-11 w-[52px] rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-1"
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          type="color"
          value={colorPickerValue}
        />
        <input
          className="h-11 min-w-0 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 font-mono text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
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

/**
 * Renders a labeled text input or textarea and forwards trimmed input values via `onChange`.
 *
 * Renders a label with optional description and either an input or a textarea depending on `multiline`.
 *
 * @param id - HTML id used for the input/textarea and label association
 * @param label - Visible label text for the control
 * @param description - Optional descriptive text shown under the label
 * @param value - Current text value shown in the input/textarea
 * @param onChange - Called when the user edits the value with the new string
 * @param placeholder - Optional placeholder shown when `value` is empty
 * @param maxLength - Optional maximum number of characters allowed
 * @param multiline - When `true`, renders a textarea instead of a single-line input
 * @param rows - Number of rows for the textarea (when `multiline` is `true`)
 * @returns A labeled form control element (an input or textarea) bound to the provided props
 */
function TextControl({
  description,
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
      <span>{label}</span>
      {description ? (
        <span className="mt-1 block text-xs font-medium leading-5 text-[var(--site-muted)]">
          {description}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm font-medium text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
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
          className="mt-2 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm font-medium text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
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

/**
 * Render a styled section card with a header (icon, title, description) and a content area.
 *
 * @param id - HTML id attribute used as the section's anchor target.
 * @param title - Visible heading text for the section.
 * @param description - Short descriptive text shown under the heading.
 * @param icon - Visual icon node displayed to the left of the heading.
 * @param children - Content rendered inside the section's body below the header.
 * @returns A section element containing the header (icon, title, description) and the provided children.
 */
function SectionCard({
  children,
  description,
  icon,
  id,
  title,
}: SectionCardProps) {
  return (
    <section
      className="scroll-mt-32 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"
      id={id}
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[var(--site-text)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
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

/**
 * Renders the administrative settings form for site branding, theme, hero image, SEO/share metadata, and contact/payment fields.
 *
 * The form reflects `draft` values for live previews, calls `onChange` to propagate edits, and invokes `onSave` when submitted. It uses `isSaving` to set form busy state and `hasUnsavedChanges` to display unsaved status.
 *
 * @returns The rendered settings form element
 */
export function SettingsForm({
  draft,
  hasUnsavedChanges,
  isSaving,
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
  const phoneContactCount = draft.phoneContacts.filter((contact) => {
    return (
      contact.name.trim().length > 0 ||
      contact.phone.trim().length > 0 ||
      contact.time.trim().length > 0
    );
  }).length;

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
      aria-busy={isSaving}
      className="grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]"
      data-unsaved={hasUnsavedChanges ? "true" : "false"}
      onSubmit={handleSubmit}
    >
      <aside className="hidden xl:block">
        <div className="sticky top-36 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm">
          <p className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-muted)]">
            ส่วนการตั้งค่า
          </p>
          <nav aria-label="เมนูส่วนการตั้งค่า" className="grid gap-1">
            {SECTION_NAV_ITEMS.map((item) => (
              <a
                className="rounded-md px-3 py-3 transition hover:bg-[var(--site-primary-soft)]"
                href={`#${item.id}`}
                key={item.id}
              >
                <p className="text-sm font-semibold text-[var(--site-text)]">
                  {item.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
                  {item.description}
                </p>
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className="grid min-w-0 content-start gap-6">
        <SectionCard
          description="ดูแลชื่อเว็บไซต์ โลโก้ และตัวตนหลักของหน้าเว็บให้สอดคล้องกันทุกจุด"
          icon={<Building2 aria-hidden="true" className="size-5" />}
          id="identity"
          title="ข้อมูลแบรนด์"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
              <TextControl
                description="ชื่อนี้จะใช้เป็นชื่อหลักของเว็บไซต์และแสดงในตัวอย่างด้านขวา"
                id="siteName"
                label="ชื่อเว็บไซต์"
                onChange={(siteName) => {
                  onChange({ siteName });
                }}
                placeholder="Pool Villas Pattaya"
                value={draft.siteName}
              />
            </div>
            <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--site-text)]">สรุปแบรนด์</p>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[var(--site-muted)]">ชื่อที่ใช้งาน</dt>
                  <dd className="text-right font-semibold text-[var(--site-text)]">
                    {draft.siteName || "ยังไม่ได้ระบุ"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[var(--site-muted)]">โลโก้ใหม่</dt>
                  <dd className="text-right font-semibold text-[var(--site-text)]">
                    {draft.logoFile ? draft.logoFile.name : "ยังไม่ได้เลือก"}
                  </dd>
                </div>
              </dl>
            </div>
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
        </SectionCard>

        <SectionCard
          description="ใช้สีหลักและสีเน้นที่เชื่อมกับธีมเว็บไซต์เดียวกันทั้งฝั่งสาธารณะและแอดมิน"
          icon={<Palette aria-hidden="true" className="size-5" />}
          id="theme"
          title="สีและธีม"
        >
          <div className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ColorControl
                description="ใช้กับปุ่มหลัก ไฮไลต์ และองค์ประกอบสำคัญ"
                id="primaryColor"
                label="สีหลัก"
                onChange={(primaryColor) => {
                  onChange({ primaryColor });
                }}
                value={draft.primaryColor}
              />
              <ColorControl
                description="ใช้เป็นสีเน้นสำหรับองค์ประกอบรองหรือจุดดึงสายตา"
                id="accentColor"
                label="สีเน้น"
                onChange={(accentColor) => {
                  onChange({ accentColor });
                }}
                value={draft.accentColor}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
                <div className="h-12 rounded-md bg-[var(--site-primary)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--site-text)]">
                  สีหลัก
                </p>
              </div>
              <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
                <div className="h-12 rounded-md bg-[var(--site-primary-soft)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--site-text)]">
                  พื้นหลังเน้น
                </p>
              </div>
              <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-3">
                <div className="h-12 rounded-md bg-[var(--site-accent)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--site-text)]">
                  สีรอง
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="จัดการรูปหลักของหน้าแรกและคำอธิบายรูปที่ใช้กับภาพเดียวกันทั้งเดสก์ท็อปและมือถือ"
          icon={<LayoutTemplate aria-hidden="true" className="size-5" />}
          id="hero"
          title="รูปหลัก"
        >
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <TextControl
              description="ใช้เป็นข้อความอธิบายรูปสำหรับการเข้าถึงและกรณีโหลดรูปไม่สำเร็จ"
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
        </SectionCard>

        <SectionCard
          description="กำหนดข้อความที่เครื่องมือค้นหาและโซเชียลเห็นเมื่อมีคนค้นหาหรือแชร์ลิงก์เว็บไซต์"
          icon={<Search aria-hidden="true" className="size-5" />}
          id="seo"
          title="SEO และการแชร์"
        >
          <div className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 lg:grid-cols-2">
            <TextControl
              description="ชื่อที่แสดงในผลการค้นหาหรือแถบชื่อหน้า"
              id="seoTitle"
              label="ชื่อหน้าบน Google"
              maxLength={80}
              onChange={(seoTitle) => {
                onChange({ seoTitle });
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
                onChange({ seoBusinessName });
              }}
              placeholder="Pool Villas Pattaya"
              value={draft.seoBusinessName}
            />
            <TextControl
              description="คำอธิบายสั้นสำหรับผลการค้นหาและการแชร์ลิงก์"
              id="seoDescription"
              label="คำอธิบายเว็บไซต์"
              maxLength={180}
              multiline
              onChange={(seoDescription) => {
                onChange({ seoDescription });
              }}
              placeholder="รวมบ้านพักพูลวิลล่าพัทยา"
              value={draft.seoDescription}
            />
            <TextControl
              description="ใส่ 1 ลิงก์ต่อ 1 บรรทัด เช่น Facebook หรือช่องทางโซเชียลหลัก"
              id="seoSameAsUrls"
              label="ลิงก์โซเชียลของร้าน"
              multiline
              onChange={updateSameAsUrls}
              placeholder="https://www.facebook.com/baanpoolvillas"
              value={draft.seoSameAsUrls.join("\n")}
            />
            <TextControl
              description="ใส่ URL รูปที่ใช้ตอนแชร์ลิงก์ หากเว้นไว้จะใช้รูปหลักของเว็บไซต์"
              id="seoOgImageUrl"
              label="รูปตอนแชร์ลิงก์"
              onChange={(seoOgImageUrl) => {
                onChange({ seoOgImageUrl });
              }}
              placeholder="/images/BPV-66_Cover-Web.jpg"
              value={draft.seoOgImageUrl}
            />
            <TextControl
              description="คำอธิบายรูปที่ใช้ในตัวอย่างการแชร์"
              id="seoOgImageAlt"
              label="คำอธิบายรูปแชร์ลิงก์"
              maxLength={160}
              onChange={(seoOgImageAlt) => {
                onChange({ seoOgImageAlt });
              }}
              placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
              value={draft.seoOgImageAlt}
            />
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้าค้นหา (/search)
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                ตั้งค่าชื่อหน้า คำอธิบาย และรูปแชร์ลิงก์สำหรับหน้าค้นหาโดยเฉพาะ
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextControl
                id="searchSeoTitle"
                label="ชื่อหน้า /search"
                maxLength={80}
                onChange={(searchSeoTitle) => {
                  onChange({ searchSeoTitle });
                }}
                placeholder="ค้นหาบ้านพักพูลวิลล่าพัทยา"
                value={draft.searchSeoTitle}
              />
              <TextControl
                id="searchSeoOgImageUrl"
                label="รูปแชร์ /search"
                onChange={(searchSeoOgImageUrl) => {
                  onChange({ searchSeoOgImageUrl });
                }}
                placeholder="/images/BPV-66_Cover-Web.jpg"
                value={draft.searchSeoOgImageUrl}
              />
              <TextControl
                id="searchSeoDescription"
                label="คำอธิบาย /search"
                maxLength={180}
                multiline
                onChange={(searchSeoDescription) => {
                  onChange({ searchSeoDescription });
                }}
                placeholder="ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน และราคา"
                value={draft.searchSeoDescription}
              />
              <TextControl
                id="searchSeoOgImageAlt"
                label="คำอธิบายรูป /search"
                maxLength={160}
                onChange={(searchSeoOgImageAlt) => {
                  onChange({ searchSeoOgImageAlt });
                }}
                placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
                value={draft.searchSeoOgImageAlt}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--site-text)]">
                SEO หน้าบทความ (/guides)
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                ตั้งค่าชื่อหน้า คำอธิบาย และรูปแชร์ลิงก์สำหรับหน้ารวมบทความ
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextControl
                id="guidesSeoTitle"
                label="ชื่อหน้า /guides"
                maxLength={80}
                onChange={(guidesSeoTitle) => {
                  onChange({ guidesSeoTitle });
                }}
                placeholder="บทความแนะนำบ้านพักพูลวิลล่าพัทยา"
                value={draft.guidesSeoTitle}
              />
              <TextControl
                id="guidesSeoOgImageUrl"
                label="รูปแชร์ /guides"
                onChange={(guidesSeoOgImageUrl) => {
                  onChange({ guidesSeoOgImageUrl });
                }}
                placeholder="/images/BPV-66_Cover-Web.jpg"
                value={draft.guidesSeoOgImageUrl}
              />
              <TextControl
                id="guidesSeoDescription"
                label="คำอธิบาย /guides"
                maxLength={180}
                multiline
                onChange={(guidesSeoDescription) => {
                  onChange({ guidesSeoDescription });
                }}
                placeholder="บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว"
                value={draft.guidesSeoDescription}
              />
              <TextControl
                id="guidesSeoOgImageAlt"
                label="คำอธิบายรูป /guides"
                maxLength={160}
                onChange={(guidesSeoOgImageAlt) => {
                  onChange({ guidesSeoOgImageAlt });
                }}
                placeholder="Pool Villa บ้านพูลวิลล่า พัทยา"
                value={draft.guidesSeoOgImageAlt}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="รวมช่องทางที่ลูกค้าใช้ติดต่อหรือโอนชำระเงิน โดยคงข้อมูลจริงที่หน้าเว็บนำไปใช้ต่อ"
          icon={<MessageCircleMore aria-hidden="true" className="size-5" />}
          id="contact"
          title="ติดต่อและชำระเงิน"
        >
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--site-surface)] text-[var(--site-primary)]">
                <Landmark aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[var(--site-text)]">
                  ข้อมูลบัญชีธนาคาร
                </h3>
                <p className="text-sm text-[var(--site-muted)]">
                  ใช้สำหรับแสดงข้อมูลชำระเงินแก่ลูกค้า
                </p>
              </div>
            </div>
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

          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--site-surface)] text-[var(--site-primary)]">
                <BadgeInfo aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[var(--site-text)]">
                  ผู้ติดต่อทางโทรศัพท์
                </h3>
                <p className="text-sm text-[var(--site-muted)]">
                  แสดงทั้งหมด {phoneContactCount || 0} รายการที่มีข้อมูลบนหน้าเว็บ
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {draft.phoneContacts.map((contact, index) => (
                <div
                  className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 lg:grid-cols-3"
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
          </div>

          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--site-surface)] text-[var(--site-primary)]">
                <Link2 aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[var(--site-text)]">
                  ช่องทางแชตและโซเชียล
                </h3>
                <p className="text-sm text-[var(--site-muted)]">
                  ใช้กับปุ่มติดต่อและลิงก์ภายนอกของเว็บไซต์
                </p>
              </div>
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
        </SectionCard>
      </div>

      <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36">
        <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
              <ShieldCheck aria-hidden="true" className="size-4" />
            </span>
            <h2 className="text-base font-bold text-[var(--site-text)]">
              สถานะการตั้งค่า
            </h2>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--site-text)]">
              {hasUnsavedChanges ? "มีรายการรอบันทึก" : "ข้อมูลล่าสุดพร้อมใช้งาน"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
              {hasUnsavedChanges
                ? "ตรวจสอบตัวอย่างด้านล่างแล้วกดบันทึกเมื่อพร้อมเผยแพร่"
                : "ค่าที่เห็นในตัวอย่างด้านล่างคือสถานะล่าสุดของหน้าเว็บ"}
            </p>
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
              <dt className="text-[var(--site-muted)]">ชื่อเว็บไซต์</dt>
              <dd className="text-right font-semibold text-[var(--site-text)]">
                {draft.siteName || "ยังไม่ได้ระบุ"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
              <dt className="text-[var(--site-muted)]">ผู้ติดต่อโทรศัพท์</dt>
              <dd className="text-right font-semibold text-[var(--site-text)]">
                {phoneContactCount} รายการ
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
              <dt className="text-[var(--site-muted)]">ลิงก์โซเชียล</dt>
              <dd className="text-right font-semibold text-[var(--site-text)]">
                {draft.seoSameAsUrls.length} รายการ
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
              <dt className="text-[var(--site-muted)]">ไฟล์ใหม่ที่เลือก</dt>
              <dd className="text-right font-semibold text-[var(--site-text)]">
                {[draft.logoFile, draft.heroFile].filter(Boolean).length} ไฟล์
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"
          style={themeStyle}
        >
          <div className="border-b border-[var(--site-border)] px-4 py-3">
            <h2 className="text-base font-bold text-[var(--site-text)]">
              ตัวอย่างหน้าเว็บ
            </h2>
          </div>
          <div className="grid gap-4 p-4">
            <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
              <div
                className="h-36 bg-cover bg-center"
                style={{ backgroundImage: cssImageUrl(heroPreviewUrl) }}
              />
              <div className="p-4">
                <p className="text-lg font-bold text-[var(--site-text)]">
                  {draft.siteName || "Pool Villas Pattaya"}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--site-muted)]">
                  {draft.heroImageAlt || "ภาพหลักของเว็บไซต์"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                    ดูบ้านพัก
                  </span>
                  <span className="inline-flex h-9 items-center rounded-md bg-[var(--site-primary-soft)] px-3 text-sm font-semibold text-[var(--site-text)]">
                    ติดต่อเรา
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--site-border)] bg-white p-4">
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
              <div className="p-4">
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
