"use client";

import { Palette } from "lucide-react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";
import { ColorControl, SectionCard } from "./settings-form-controls";
import {
  buildDraftThemeStyle,
  buildThemeSettingsJson,
  makeThemeSettingsSnapshot,
  mapThemeSettingsResponse,
} from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { validateThemeSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";

const THEME_PREVIEW_SETTINGS: SiteSettings = {
  ...DEFAULT_SITE_SETTINGS,
  siteName: "บ้านพักตัวอย่าง",
  bank: {
    accountName: "คุณมินท์ ใจดี",
    bankName: "ธนาคารตัวอย่าง",
    accountNumber: "123-4-56789-0",
  },
  contact: {
    phoneContacts: [
      { name: "คุณมินท์", phone: "081-234-5678", time: "ช่วง 09.00-18.00" },
      { name: "คุณนนท์", phone: "089-876-5432", time: "ช่วง 10.00-20.00" },
    ],
    messengerUrl: "https://example.com/messenger",
    lineId: "@examplevilla",
    lineUrl: "https://example.com/line",
  },
};

export function ThemeSettingsPage() {
  const state = useAdminSettingsSection({
    section: "theme",
    mapResponse: mapThemeSettingsResponse,
    makeSnapshot: makeThemeSettingsSnapshot,
    buildRequest: (draft) => ({
      body: buildThemeSettingsJson(draft),
      headers: { "Content-Type": "application/json" },
    }),
    validate: validateThemeSettingsDraft,
  });
  const { draft } = state;
  const themeStyle = draft ? buildDraftThemeStyle(draft) : undefined;
  const previewSettings = draft ? { ...THEME_PREVIEW_SETTINGS, ...draft } : null;

  return (
    <div className="grid gap-5">
      <SettingsSectionHeader
        title="สีและธีม"
        description="ปรับสีให้ตรงกับส่วนที่แสดงจริงบนเว็บไซต์"
        hasUnsavedChanges={state.hasUnsavedChanges}
        isSaving={state.isSaving}
        onSave={state.save}
      />
      <AdminFeedback
        errors={state.errors}
        errorTitle="กรุณาแก้ไขก่อนบันทึก:"
        notice={state.notice}
        warnings={state.warnings}
      />
      {state.isLoading ? (
        <SettingsSectionSkeleton />
      ) : draft ? (
        <div className="settings-preview-theme grid min-w-0 gap-5" style={themeStyle}>
          <div data-theme-color-group="primary-actions">
            <SectionCard
              description="เลือกสีที่เห็นบนพื้นเว็บไซต์ ปุ่ม ราคา และข้อมูลติดต่อ"
              icon={<Palette aria-hidden="true" className="size-5" />}
              id="theme-primary-actions"
              title="สีพื้นหลักและสีเน้น"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ColorControl
                  id="primaryColor"
                  label="สีพื้นหลักของเว็บไซต์"
                  description="ใช้กับพื้น Header, Footer, ปุ่มหลัก และลิงก์สำคัญ"
                  value={draft.primaryColor}
                  onChange={(value) => state.updateDraft({ primaryColor: value })}
                />
                <ColorControl
                  id="accentColor"
                  label="สีเน้นสำหรับข้อมูลสำคัญ"
                  description="ใช้กับราคา สถานะ และข้อมูลติดต่อ"
                  value={draft.accentColor}
                  onChange={(value) => state.updateDraft({ accentColor: value })}
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] text-sm">

                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span className="font-bold text-[var(--site-accent)]">ราคาเริ่มต้น 8,900</span>
                  <button
                    className="rounded-md bg-[var(--site-primary)] px-3 py-2 text-xs font-semibold text-[var(--site-on-primary)]"
                    type="button"
                  >
                    ค้นหาบ้านพัก
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div data-theme-color-group="header-menu">
            <SectionCard
              description="เปลี่ยนสีลิงก์เมนูบนแถบ Header ของเดสก์ท็อป"
              icon={<Palette aria-hidden="true" className="size-5" />}
              id="theme-header-menu"
              title="เมนูบน Header (เดสก์ท็อป)"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ColorControl
                  id="headerLinkColor"
                  label="สีลิงก์เมนู"
                  description="ใช้กับเมนูบน Header ของเดสก์ท็อป"
                  value={draft.headerLinkColor}
                  onChange={(value) => state.updateDraft({ headerLinkColor: value })}
                />
                <ColorControl
                  id="headerLinkHoverColor"
                  label="สีลิงก์เมื่อชี้เมาส์"
                  description="ใช้เมื่อชี้เมาส์ที่เมนูบน Header"
                  value={draft.headerLinkHoverColor}
                  onChange={(value) => state.updateDraft({ headerLinkHoverColor: value })}
                />
              </div>
              <div
                className="overflow-hidden rounded-lg"
                data-theme-preview="header"
                onAuxClickCapture={(event) => event.preventDefault()}
                onClickCapture={(event) => event.preventDefault()}
                onKeyDownCapture={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.preventDefault();
                }}
              >
                {previewSettings ? <SiteHeader previewMode settings={previewSettings} /> : null}
              </div>
            </SectionCard>
          </div>

          <div data-theme-color-group="bank-details">
            <SectionCard
              description="เปลี่ยนสีข้อความข้อมูลโอนเงินที่แสดงบน Header และ Footer"
              icon={<Palette aria-hidden="true" className="size-5" />}
              id="theme-bank-details"
              title="ข้อมูลโอนเงินใน Header และ Footer"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ColorControl
                  id="bankAccountHighlightColor"
                  label="สีชื่อบัญชี"
                  description="ใช้กับข้อความชื่อบัญชี"
                  value={draft.bankAccountHighlightColor}
                  onChange={(value) => state.updateDraft({ bankAccountHighlightColor: value })}
                />
                <ColorControl
                  id="bankNameHighlightColor"
                  label="สีชื่อธนาคาร"
                  description="ใช้กับข้อความชื่อธนาคาร"
                  value={draft.bankNameHighlightColor}
                  onChange={(value) => state.updateDraft({ bankNameHighlightColor: value })}
                />
                <ColorControl
                  id="bankNumberHighlightColor"
                  label="สีเลขบัญชี"
                  description="ใช้กับข้อความเลขบัญชี"
                  value={draft.bankNumberHighlightColor}
                  onChange={(value) => state.updateDraft({ bankNumberHighlightColor: value })}
                />
              </div>
              <div className="rounded-lg bg-[var(--site-primary)] p-4 text-sm text-[var(--site-on-primary)]">
                กรุณาโอนเงิน{" "}
                <span className="font-semibold text-[var(--site-bank-account-highlight)]">ชื่อบัญชี {THEME_PREVIEW_SETTINGS.bank.accountName}</span>{" "}
                <span className="font-semibold text-[var(--site-bank-name-highlight)]">{THEME_PREVIEW_SETTINGS.bank.bankName}</span>{" "}
                <span className="font-semibold text-[var(--site-bank-number-highlight)]">เลขที่ {THEME_PREVIEW_SETTINGS.bank.accountNumber}</span>
              </div>
            </SectionCard>
          </div>

          <div data-theme-color-group="footer-menu">
            <SectionCard
              description="เปลี่ยนสีลิงก์ในส่วนท้ายเว็บไซต์"
              icon={<Palette aria-hidden="true" className="size-5" />}
              id="theme-footer-menu"
              title="เมนูใน Footer"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ColorControl
                  id="footerLinkColor"
                  label="สีลิงก์เมนู"
                  description="ใช้กับลิงก์ในส่วนท้ายเว็บไซต์"
                  value={draft.footerLinkColor}
                  onChange={(value) => state.updateDraft({ footerLinkColor: value })}
                />
                <ColorControl
                  id="footerLinkHoverColor"
                  label="สีลิงก์เมื่อชี้เมาส์"
                  description="ใช้เมื่อชี้เมาส์ที่ลิงก์ใน Footer"
                  value={draft.footerLinkHoverColor}
                  onChange={(value) => state.updateDraft({ footerLinkHoverColor: value })}
                />
              </div>
              <div
                className="overflow-hidden rounded-lg"
                data-theme-preview="footer"
                onAuxClickCapture={(event) => event.preventDefault()}
                onClickCapture={(event) => event.preventDefault()}
                onKeyDownCapture={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.preventDefault();
                }}
              >
                {previewSettings ? <SiteFooter settings={previewSettings} /> : null}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
