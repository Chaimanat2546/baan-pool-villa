"use client";

import { Images, LayoutPanelTop, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminVillaCardImagesPage } from "@/components/admin/villa-card-images/admin-villa-card-images-page";
import { SiteHeader } from "@/components/layout/site-header";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { getContrastRatio } from "@/lib/site-settings/colors";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import { validateWebStyleDraft } from "@/lib/site-web-styles/validation";
import { ColorControl, SectionCard } from "./settings-form-controls";
import { isHexColor } from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { useAdminSettingsSection } from "./use-admin-settings-section";
import type { ThemeSettingsDraft } from "./types";

type HeaderDraft = { desktopHeaderVariant: "centered-contact" | "right-booking" };
type GalleryDraft = GalleryStyleSettings & {
  backgroundColor: string;
  textColor: string;
};

const OPTIONS: { value: HeaderDraft["desktopHeaderVariant"]; label: string; description: string }[] = [
  { value: "centered-contact", label: "เมนูกลางพร้อมติดต่อ", description: "เมนูอยู่กลาง พร้อมโทรและ LINE ด้านขวา" },
  { value: "right-booking", label: "เมนูขวาพร้อมจอง", description: "เมนูด้านขวา พร้อมปุ่มจองเลย" },
];

const GALLERY_OPTIONS: Array<{
  description: string;
  label: string;
  value: GalleryDraft["variant"];
}> = [
  {
    description: "ลูกค้ากดรูปแล้วดูภาพใหญ่ได้เลย พร้อมรูปอื่นในหมวดเดียวกันด้านล่าง",
    label: "เปิดรูปใหญ่ทันที",
    value: "lightbox",
  },
  {
    description: "ลูกค้าดูหน้ารวมรูปแยกหมวดก่อน แล้วค่อยเลือกรูปที่ต้องการดูแบบใหญ่",
    label: "ดูรูปทั้งหมดแยกตามหมวดก่อน",
    value: "categorized-grid",
  },
];

const HEADER_PREVIEW_SETTINGS = {
  ...DEFAULT_SITE_SETTINGS,
  siteName: "บ้านพักตัวอย่าง",
};
const HEADER_PREVIEW_CONTACT_SETTINGS = {
  bank: {
    accountName: "คุณมินท์ ใจดี",
    bankName: "ธนาคารตัวอย่าง",
    accountNumber: "123-4-56789-0",
  },
  contact: {
    phoneContacts: [{ name: "คุณมินท์", phone: "081-234-5678", time: "09.00-18.00" }],
    messengerUrl: "https://example.com/messenger",
    showFacebookTimeline: true,
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
  const galleryState = useAdminSettingsSection<GalleryDraft>({
    section: "gallery",
    endpoint: "/api/admin/site-web-styles/gallery",
    mapResponse: (value) => {
      const settings = (value as { settings: GalleryStyleSettings }).settings;
      return {
        backgroundColor: settings.backgroundColor ?? "",
        textColor: settings.textColor ?? "",
        variant: settings.variant,
      };
    },
    makeSnapshot: JSON.stringify,
    buildRequest: (draft) => ({
      body: JSON.stringify(draft),
      headers: { "Content-Type": "application/json" },
    }),
    validate: (draft) => validateWebStyleDraft("gallery", draft),
  });
  const draft = state.draft;
  const selectedOption = OPTIONS.find((option) => option.value === draft?.desktopHeaderVariant);
  const galleryDraft = galleryState.draft;
  const hasExplicitContrast = Boolean(
    galleryDraft &&
      isHexColor(galleryDraft.backgroundColor) &&
      isHexColor(galleryDraft.textColor),
  );
  const hasLowContrast = Boolean(
    hasExplicitContrast &&
      galleryDraft &&
      getContrastRatio(galleryDraft.textColor, galleryDraft.backgroundColor) < 4.5,
  );

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
    <SettingsSectionHeader title="รูปแบบเว็บ" description="เลือกรูปแบบ Header, Gallery และการ์ดบ้าน" />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <SectionCard action={<button className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:opacity-70" data-header-style-save disabled={state.isSaving || !state.hasUnsavedChanges} onClick={() => void state.save()} type="button"><Save aria-hidden="true" className={state.isSaving ? "size-4 animate-pulse" : "size-4"} />{state.isSaving ? "กำลังบันทึก..." : "บันทึกรูปแบบ Header"}</button>} icon={<LayoutPanelTop className="size-5" />} id="desktop-header-variant" title="รูปแบบ Header บน Desktop" description="มือถือคงรูปแบบเดิมเสมอ">
      <div className="grid gap-3 sm:grid-cols-2">{OPTIONS.map((option) => <label key={option.value} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--site-border)] p-4 has-[:checked]:border-[var(--site-primary)] has-[:checked]:bg-[var(--site-primary-soft)]"><input checked={draft.desktopHeaderVariant === option.value} name="desktopHeaderVariant" onChange={() => state.updateDraft({ desktopHeaderVariant: option.value })} type="radio" value={option.value} /><span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-[var(--site-text-muted)]">{option.description}</span></span></label>)}</div>
      <div className="mt-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 lg:hidden" data-header-mobile-summary>
        <p className="text-sm font-semibold text-[var(--site-text)]">{selectedOption?.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">{selectedOption?.description}</p>
        <p className="mt-3 text-xs font-medium text-[var(--site-muted)]">การตั้งค่านี้มีผลกับ Header บน Desktop เท่านั้น</p>
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg lg:block" data-header-preview onAuxClickCapture={(event) => event.preventDefault()} onClickCapture={(event) => event.preventDefault()} onKeyDownCapture={(event) => { if (event.key === "Enter" || event.key === " ") event.preventDefault(); }}>
        <SiteHeader contactSettings={HEADER_PREVIEW_CONTACT_SETTINGS} desktopHeaderVariant={draft.desktopHeaderVariant} previewMode settings={{ ...HEADER_PREVIEW_SETTINGS, ...previewTheme }} />
      </div>
    </SectionCard> : null}
    <AdminFeedback errors={galleryState.errors} errorTitle="กรุณาแก้ไขการแสดงรูปก่อนบันทึก:" notice={galleryState.notice} warnings={galleryState.warnings} />
    {galleryState.isLoading ? <SettingsSectionSkeleton /> : galleryDraft ? <SectionCard
      action={<button className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60" data-gallery-style-save disabled={galleryState.isSaving || !galleryState.hasUnsavedChanges} onClick={() => void galleryState.save()} type="button"><Save aria-hidden="true" className="size-4" />{galleryState.isSaving ? "กำลังบันทึก..." : "บันทึกวิธีแสดงรูป"}</button>}
      description="เลือกสิ่งที่ลูกค้าจะเห็นเมื่อกดดูรูปในหน้ารายละเอียดบ้าน"
      icon={<Images className="size-5" />}
      id="gallery-modal-style"
      title="วิธีเปิดดูรูปของบ้าน"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {GALLERY_OPTIONS.map((option) => <label className="flex cursor-pointer gap-3 rounded-lg border border-[var(--site-border)] p-4 has-[:checked]:border-[var(--site-primary)] has-[:checked]:bg-[var(--site-primary-soft)]" key={option.value}>
          <input checked={galleryDraft.variant === option.value} name="galleryVariant" onChange={() => galleryState.updateDraft({ variant: option.value })} type="radio" value={option.value} />
          <span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-[var(--site-text-muted)]">{option.description}</span></span>
        </label>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <ColorControl id="galleryBackgroundColor" label="สีพื้นหลังหน้าดูรูป" onChange={(backgroundColor) => galleryState.updateDraft({ backgroundColor })} value={galleryDraft.backgroundColor} />
          <button className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[var(--site-primary)]" data-clear-gallery-background onClick={() => galleryState.updateDraft({ backgroundColor: "" })} type="button"><X className="size-3.5" />ล้างค่าเพื่อใช้สีตามธีม</button>
        </div>
        <div className="grid gap-2">
          <ColorControl id="galleryTextColor" label="สีข้อความหน้าดูรูป" onChange={(textColor) => galleryState.updateDraft({ textColor })} value={galleryDraft.textColor} />
          <button className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[var(--site-primary)]" data-clear-gallery-text onClick={() => galleryState.updateDraft({ textColor: "" })} type="button"><X className="size-3.5" />ล้างค่าเพื่อใช้สีตามธีม</button>
        </div>
      </div>
      {hasLowContrast ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="status">สีพื้นหลังและตัวอักษรมีความต่างกันน้อย อาจอ่านได้ยาก</p> : null}
      <div className="overflow-hidden rounded-xl border border-[var(--site-border)]" data-gallery-preview-variant={galleryDraft.variant} data-gallery-style-preview style={{ backgroundColor: galleryDraft.backgroundColor || "var(--site-primary-hover)", color: galleryDraft.textColor || "var(--site-on-primary)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 px-4 py-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide opacity-65">ตัวอย่างที่ลูกค้าจะเห็น</p><strong className="mt-0.5 block text-sm">{GALLERY_OPTIONS.find((option) => option.value === galleryDraft.variant)?.label}</strong></div>
          <X aria-hidden="true" className="size-5" />
        </div>
        {galleryDraft.variant === "lightbox" ? (
          <div className="grid gap-3 p-4 sm:p-5">
            <div className="grid min-h-44 place-items-center rounded-lg border border-current/20 bg-current/10 text-sm font-semibold sm:min-h-56" data-gallery-preview-main-image data-gallery-preview-image>รูปภาพ</div>
            <div className="flex gap-2 overflow-hidden" data-gallery-preview-thumbnails>
              {[1, 2, 3, 4].map((item) => <div className="grid aspect-[4/3] w-20 shrink-0 place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold sm:w-24" data-gallery-preview-image key={item}>รูปภาพ</div>)}
            </div>
            <p className="text-xs font-medium opacity-70">กดรูปแล้วดูรูปใหญ่ · รูปด้านล่างอยู่ในหมวดเดียวกัน</p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-5" data-gallery-preview-categories>
            <div className="flex gap-2 overflow-hidden">{["รูปปก (1)", "ภายนอก (8)", "ห้องนอน (6)"].map((label) => <span className="shrink-0 rounded-full border border-current/25 bg-current/10 px-3 py-1.5 text-xs font-semibold" key={label}>{label}</span>)}</div>
            <div className="grid gap-2"><div className="flex items-center justify-between text-xs font-semibold"><span>ภายนอก</span><span className="opacity-60">8 รูป</span></div><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((item) => <div className="grid aspect-[4/3] place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold" data-gallery-preview-image key={item}>รูปภาพ</div>)}</div></div>
            <div className="grid gap-2"><div className="flex items-center justify-between text-xs font-semibold"><span>ห้องนอน</span><span className="opacity-60">6 รูป</span></div><div className="grid grid-cols-2 gap-2">{[1, 2].map((item) => <div className="grid aspect-[5/3] place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold" data-gallery-preview-image key={item}>รูปภาพ</div>)}</div></div>
            <p className="text-xs font-medium opacity-70">เลือกหมวดก่อน แล้วกดรูปเพื่อดูแบบใหญ่</p>
          </div>
        )}
      </div>
    </SectionCard> : null}
    <AdminVillaCardImagesPage embedded />
  </div>;
}
