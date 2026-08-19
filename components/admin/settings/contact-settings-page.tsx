"use client";

import { ArrowDown, ArrowUp, BadgeInfo, Landmark, Link2, MessageCircleMore, Plus, Trash2 } from "lucide-react";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { SectionCard, TextControl } from "./settings-form-controls";
import { SettingsSectionHeader } from "./settings-section-header";
import { SettingsSectionSkeleton } from "./settings-section-skeleton";
import { addPhoneContact, buildContactSettingsJson, makeContactSettingsSnapshot, mapContactSettingsResponse, movePhoneContact, removePhoneContact, updatePhoneContact } from "./settings-helpers";
import { validateContactSettingsDraft } from "./settings-validation";
import { useAdminSettingsSection } from "./use-admin-settings-section";

export function ContactSettingsPage() {
  const state = useAdminSettingsSection({ section: "contact", mapResponse: mapContactSettingsResponse, makeSnapshot: makeContactSettingsSnapshot, buildRequest: (draft) => ({ body: buildContactSettingsJson(draft), headers: { "Content-Type": "application/json" } }), validate: validateContactSettingsDraft });
  const { draft } = state;
  const phoneContactCount = draft?.phoneContacts.filter((contact) => contact.name.trim() || contact.phone.trim() || contact.time.trim()).length ?? 0;
  const bankPreviewAccountName = draft?.bankAccountName || "คุณ อาภัสรา จินดาวา";
  const bankPreviewName = draft?.bankName || "ธนาคารกสิกรไทย";
  const bankPreviewNumber = draft?.bankAccountNumber || "398-289-7482";

  return (
    <div className="grid gap-5">
      <SettingsSectionHeader title="ติดต่อและชำระเงิน" description="จัดการช่องทางติดต่อและข้อมูลบัญชีธนาคารที่ใช้จริงบนหน้าเว็บไซต์" hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.save} />
      <AdminFeedback errors={state.errors} errorTitle="กรุณาแก้ไขก่อนบันทึก:" notice={state.notice} warnings={state.warnings} />
      {state.isLoading ? <SettingsSectionSkeleton /> : draft ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                  state.updateDraft({ bankAccountName });
                }}
                placeholder="คุณ อาภัสรา จินดาวา"
                value={draft.bankAccountName}
              />
              <TextControl
                id="bankName"
                label="ชื่อธนาคาร"
                onChange={(bankName) => {
                  state.updateDraft({ bankName });
                }}
                placeholder="ธนาคารกสิกรไทย"
                value={draft.bankName}
              />
              <TextControl
                id="bankAccountNumber"
                label="เลขบัญชี"
                onChange={(bankAccountNumber) => {
                  state.updateDraft({ bankAccountNumber });
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
                  แสดงทั้งหมด {phoneContactCount || 0}{" "}
                  รายการที่มีข้อมูลบนหน้าเว็บ
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {draft.phoneContacts.map((contact, index) => (
                <div
                  className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4"
                  key={index}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--site-text)]">
                      ผู้ติดต่อ {index + 1}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`เลื่อนผู้ติดต่อ ${index + 1} ขึ้น`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:border-[var(--site-border-strong)] hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => state.updateDraft({ phoneContacts: movePhoneContact(draft.phoneContacts, index, -1) })}
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label={`เลื่อนผู้ติดต่อ ${index + 1} ลง`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:border-[var(--site-border-strong)] hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={index === draft.phoneContacts.length - 1}
                        onClick={() => state.updateDraft({ phoneContacts: movePhoneContact(draft.phoneContacts, index, 1) })}
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </button>
                    {draft.phoneContacts.length > 1 ? (
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                        onClick={() => {
                          state.updateDraft({ phoneContacts: removePhoneContact(draft.phoneContacts, index) });
                        }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        ลบผู้ติดต่อ
                      </button>
                    ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <TextControl
                      id={`phoneContactName-${index}`}
                      label={`ชื่อผู้ติดต่อ ${index + 1}`}
                      onChange={(name) => {
                        state.updateDraft({ phoneContacts: updatePhoneContact(draft.phoneContacts, index, { name }) });
                      }}
                      placeholder="คุณเกม"
                      value={contact.name}
                    />
                    <TextControl
                      id={`phoneContactPhone-${index}`}
                      inputMode="tel"
                      label={`เบอร์โทร ${index + 1}`}
                      onChange={(phone) => {
                        state.updateDraft({ phoneContacts: updatePhoneContact(draft.phoneContacts, index, { phone }) });
                      }}
                      placeholder="0617485213"
                      value={contact.phone}
                    />
                    <TextControl
                      id={`phoneContactTime-${index}`}
                      label={`ช่วงเวลา ${index + 1}`}
                      onChange={(time) => {
                        state.updateDraft({ phoneContacts: updatePhoneContact(draft.phoneContacts, index, { time }) });
                      }}
                      placeholder="ช่วง 07.00-15.00"
                      value={contact.time}
                    />
                  </div>
                </div>
              ))}
              {draft.phoneContacts.length < 4 ? <button
                className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)] hover:bg-[var(--site-primary-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]/20"
                onClick={() => state.updateDraft({ phoneContacts: addPhoneContact(draft.phoneContacts) })}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                เพิ่มผู้ติดต่อ
              </button> : null}
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
                  state.updateDraft({ messengerUrl });
                }}
                placeholder="https://www.facebook.com/baanpoolvillas"
                value={draft.messengerUrl}
              />
              <TextControl
                id="facebookPageName"
                label="ชื่อเพจ Facebook"
                maxLength={120}
                onChange={(facebookPageName) => state.updateDraft({ facebookPageName })}
                placeholder="ชื่อเพจ Facebook"
                value={draft.facebookPageName}
              />
              <TextControl
                id="lineId"
                label="LINE ID"
                onChange={(lineId) => {
                  state.updateDraft({ lineId });
                }}
                placeholder="@baanpoolvilla"
                value={draft.lineId}
              />
              <TextControl
                id="lineUrl"
                label="ลิงก์ LINE"
                onChange={(lineUrl) => {
                  state.updateDraft({ lineUrl });
                }}
                placeholder="https://line.me/R/ti/p/@baanpoolvilla"
                value={draft.lineUrl}
              />
            </div>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
              <span>
                <span className="block text-sm font-semibold text-[var(--site-text)]">แสดง Facebook Timeline</span>
                <span className="mt-1 block text-sm text-[var(--site-muted)]">ปิดเมื่อลิงก์เพจมีปัญหาหรือไม่ต้องการแสดงโพสต์ใน Footer</span>
              </span>
              <input
                aria-label="แสดง Facebook Timeline"
                checked={draft.showFacebookTimeline}
                className="size-5 shrink-0 accent-[var(--site-primary)]"
                onChange={(event) => {
                  state.updateDraft({ showFacebookTimeline: event.target.checked });
                }}
                type="checkbox"
              />
            </label>
          </div>
        </SectionCard>
          <aside className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"><h2 className="font-bold">สรุปข้อมูลติดต่อ</h2><dl className="mt-4 grid gap-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">เบอร์โทร</dt><dd className="font-semibold">{draft.phoneContacts.filter((item) => item.name.trim() || item.phone.trim() || item.time.trim()).length} รายการ</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">Messenger</dt><dd className="max-w-40 truncate font-semibold">{draft.messengerUrl}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--site-muted)]">LINE</dt><dd className="font-semibold">{draft.lineId}</dd></div></dl><div className="mt-5 rounded-md bg-[var(--site-primary-soft)] p-4"><Landmark className="size-5 text-[var(--site-primary)]" /><p className="mt-2 font-semibold">{bankPreviewName}</p><p className="mt-1 text-sm">{bankPreviewNumber}</p><p className="text-sm text-[var(--site-muted)]">{bankPreviewAccountName}</p></div></aside>
        </div>
      ) : null}
    </div>
  );
}
