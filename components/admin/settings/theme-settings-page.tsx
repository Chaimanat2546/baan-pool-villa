"use client";

import { Palette } from "lucide-react";
import type { ReactNode } from "react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { ColorControl, SectionCard } from "./settings-form-controls";
import { buildDraftThemeStylesheetHref, buildThemeSettingsJson, makeThemeSettingsSnapshot, mapThemeSettingsResponse } from "./settings-helpers";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { validateThemeSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";
import type { ThemeSettingsDraft } from "./types";

const COLORS: { key: keyof ThemeSettingsDraft; label: string; description: string }[] = [
  { key: "primaryColor", label: "สีหลัก", description: "ใช้กับปุ่มหลัก ไฮไลต์ และองค์ประกอบสำคัญ" },
  { key: "accentColor", label: "สีเน้น", description: "ใช้เป็นสีเน้นสำหรับองค์ประกอบรอง" },
  { key: "headerLinkColor", label: "สีเมนูใน Header", description: "สีข้อความลิงก์ใน Header" },
  { key: "headerLinkHoverColor", label: "สี Hover เมนูใน Header", description: "สีลิงก์เมื่อชี้เมาส์" },
  { key: "footerLinkColor", label: "สีเมนูใน Footer", description: "สีข้อความลิงก์ใน Footer" },
  { key: "footerLinkHoverColor", label: "สี Hover เมนูใน Footer", description: "สีลิงก์เมื่อชี้เมาส์" },
  { key: "bankHighlightColor", label: "สีไฮไลท์บัญชี", description: "สีไฮไลท์ข้อมูลบัญชี" },
  { key: "bankAccountHighlightColor", label: "สีชื่อบัญชี", description: "ใช้กับข้อความชื่อบัญชี" },
  { key: "bankNameHighlightColor", label: "สีชื่อธนาคาร", description: "ใช้กับข้อความชื่อธนาคาร" },
  { key: "bankNumberHighlightColor", label: "สีเลขบัญชี", description: "ใช้กับข้อความเลขบัญชี" },
];

function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"><h2 className="border-b border-[var(--site-border)] px-4 py-3 text-sm font-bold text-[var(--site-text)]">{title}</h2><div className="p-4">{children}</div></section>;
}

export function ThemeSettingsPage() {
  const state = useAdminSettingsSection({ section: "theme", mapResponse: mapThemeSettingsResponse, makeSnapshot: makeThemeSettingsSnapshot, buildRequest: (draft) => ({ body: buildThemeSettingsJson(draft), headers: { "Content-Type": "application/json" } }), validate: validateThemeSettingsDraft });
  const { draft } = state;
  const themeHref = draft ? buildDraftThemeStylesheetHref(draft) : "";
  return <div className="grid gap-5">
    <SettingsSectionHeader title="สีและธีม" description="ปรับสีหลัก ลิงก์ และข้อมูลไฮไลท์ที่ใช้ร่วมกันทั้งเว็บไซต์" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
    <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
    {state.isLoading ? <SettingsSectionSkeleton /> : draft ? <div className="settings-preview-theme grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><link href={themeHref} rel="stylesheet" />
      <SectionCard description="ใช้สีจากธีมเว็บไซต์เดียวกันทั้งฝั่งสาธารณะและแอดมิน" icon={<Palette aria-hidden="true" className="size-5" />} id="theme" title="สีและธีม"><div className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"><div className="grid gap-4 lg:grid-cols-2">{COLORS.map(({ key, label, description }) => <ColorControl key={key} id={key} label={label} description={description} value={draft[key]} onChange={(value) => state.updateDraft({ [key]: value })} />)}</div></div></SectionCard>
      <aside><section aria-label="ตัวอย่างสีที่ใช้จริง" className="grid gap-4"><PreviewCard title="ตัวอย่าง Header"><div className="bg-[var(--site-primary)] p-4 text-[var(--site-on-primary)]"><p className="font-bold">Pool Villas Pattaya</p><nav aria-label="เมนู Header ตัวอย่าง" className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><span className="text-[var(--site-header-link)]">หน้าแรก</span><span className="text-[var(--site-header-link-hover)]">ค้นหาบ้านพัก (Hover)</span></nav></div></PreviewCard><PreviewCard title="ตัวอย่างปุ่มและสีเน้น"><button className="rounded-md bg-[var(--site-primary)] px-4 py-2 text-sm font-semibold text-[var(--site-on-primary)]" type="button">ดูบ้านพัก</button><span className="ml-3 font-semibold text-[var(--site-accent)]">สีเน้น</span></PreviewCard><PreviewCard title="ตัวอย่างข้อมูลบัญชี"><p className="text-sm">กรุณาโอนเงิน <span className="text-[var(--site-bank-highlight)]">ข้อมูลบัญชี</span> <span className="text-[var(--site-bank-account-highlight)]">ชื่อบัญชี</span> <span className="text-[var(--site-bank-name-highlight)]">ชื่อธนาคาร</span> <span className="text-[var(--site-bank-number-highlight)]">เลขบัญชี</span></p></PreviewCard><PreviewCard title="ตัวอย่าง Footer"><footer className="bg-[var(--site-primary)] p-4 text-xs"><span className="text-[var(--site-footer-link)]">ติดต่อเรา</span><span className="ml-3 text-[var(--site-footer-link-hover)]">บทความ (Hover)</span></footer></PreviewCard></section></aside>
    </div> : null}
  </div>;
}
