"use client";

import { Images, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
} from "react";

import { AdminFeedback } from "@/components/admin/admin-feedback";
import { getContrastRatio } from "@/lib/site-settings/colors";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import { validateWebStyleDraft } from "@/lib/site-web-styles/validation";
import {
  ColorControl,
} from "@/components/admin/settings/settings-form-controls";
import { isHexColor } from "@/components/admin/settings/settings-helpers";
import { SettingsDirtyStateProvider } from "@/components/admin/settings/settings-dirty-state";
import { useAdminSettingsSection } from "@/components/admin/settings/use-admin-settings-section";

type GalleryDraft = GalleryStyleSettings & {
  backgroundColor: string;
  textColor: string;
};

export type GalleryStyleEditorHandle = {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  save: () => Promise<void>;
};

export type GalleryStyleEditorSaveState = Omit<
  GalleryStyleEditorHandle,
  "save"
>;

type GalleryStyleEditorProps = {
  onSaveStateChange?: (state: GalleryStyleEditorSaveState) => void;
};

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

const GalleryStyleEditorContent = forwardRef<
  GalleryStyleEditorHandle,
  GalleryStyleEditorProps
>(function GalleryStyleEditorContent({ onSaveStateChange }, ref) {
  const state = useAdminSettingsSection<GalleryDraft>({
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
  const hasExplicitContrast = Boolean(
    draft && isHexColor(draft.backgroundColor) && isHexColor(draft.textColor),
  );
  const hasLowContrast = Boolean(
    hasExplicitContrast &&
      draft &&
      getContrastRatio(draft.textColor, draft.backgroundColor) < 4.5,
  );

  useImperativeHandle(
    ref,
    () => ({
      hasUnsavedChanges: state.hasUnsavedChanges,
      isLoading: state.isLoading,
      isSaving: state.isSaving,
      save: state.save,
    }),
    [state.hasUnsavedChanges, state.isLoading, state.isSaving, state.save],
  );

  useEffect(() => {
    onSaveStateChange?.({
      hasUnsavedChanges: state.hasUnsavedChanges,
      isLoading: state.isLoading,
      isSaving: state.isSaving,
    });
  }, [
    onSaveStateChange,
    state.hasUnsavedChanges,
    state.isLoading,
    state.isSaving,
  ]);

  return (
    <section
      className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm"
      data-gallery-style-editor="true"
    >
      <div className="border-b border-[var(--site-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--site-text)]">
              วิธีเปิดดูรูปของบ้าน
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
              เลือกสิ่งที่ลูกค้าจะเห็นเมื่อกดดูรูปในหน้ารายละเอียดบ้าน
            </p>
          </div>
          <Images aria-hidden="true" className="size-5 shrink-0 text-[var(--site-primary)]" />
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <AdminFeedback
          errors={state.errors}
          errorTitle="กรุณาแก้ไขการแสดงรูปก่อนบันทึก:"
          notice={state.notice}
          warnings={state.warnings}
        />
        {state.isLoading || !draft ? (
          <p className="text-sm text-[var(--site-muted)]">กำลังโหลดการตั้งค่ารูป...</p>
        ) : (
          <>
            <div className="grid gap-3">
              {GALLERY_OPTIONS.map((option) => (
                <label
                  className="flex cursor-pointer gap-3 rounded-lg border border-[var(--site-border)] p-3 has-[:checked]:border-[var(--site-primary)] has-[:checked]:bg-[var(--site-primary-soft)]"
                  key={option.value}
                >
                  <input
                    checked={draft.variant === option.value}
                    name="galleryVariant"
                    onChange={() => state.updateDraft({ variant: option.value })}
                    type="radio"
                    value={option.value}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--site-text-muted)]">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <ColorControl
                  id="galleryBackgroundColor"
                  label="สีพื้นหลังหน้าดูรูป"
                  onChange={(backgroundColor) => state.updateDraft({ backgroundColor })}
                  value={draft.backgroundColor}
                />
                <button
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[var(--site-primary)]"
                  data-clear-gallery-background
                  onClick={() => state.updateDraft({ backgroundColor: "" })}
                  type="button"
                >
                  <X className="size-3.5" />ล้างค่าเพื่อใช้สีตามธีม
                </button>
              </div>
              <div className="grid gap-2">
                <ColorControl
                  id="galleryTextColor"
                  label="สีข้อความหน้าดูรูป"
                  onChange={(textColor) => state.updateDraft({ textColor })}
                  value={draft.textColor}
                />
                <button
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[var(--site-primary)]"
                  data-clear-gallery-text
                  onClick={() => state.updateDraft({ textColor: "" })}
                  type="button"
                >
                  <X className="size-3.5" />ล้างค่าเพื่อใช้สีตามธีม
                </button>
              </div>
            </div>

            {hasLowContrast ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="status">
                สีพื้นหลังและตัวอักษรมีความต่างกันน้อย อาจอ่านได้ยาก
              </p>
            ) : null}

            <div
              className="overflow-hidden rounded-xl border border-[var(--site-border)]"
              data-gallery-preview-variant={draft.variant}
              data-gallery-style-preview
              style={{
                backgroundColor: draft.backgroundColor || "var(--site-primary-hover)",
                color: draft.textColor || "var(--site-on-primary)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-65">ตัวอย่างที่ลูกค้าจะเห็น</p>
                  <strong className="mt-0.5 block text-sm">
                    {GALLERY_OPTIONS.find((option) => option.value === draft.variant)?.label}
                  </strong>
                </div>
                <X aria-hidden="true" className="size-5" />
              </div>
              {draft.variant === "lightbox" ? (
                <div className="grid gap-3 p-4">
                  <div className="grid min-h-44 place-items-center rounded-lg border border-current/20 bg-current/10 text-sm font-semibold" data-gallery-preview-image data-gallery-preview-main-image>รูปภาพ</div>
                  <div className="flex gap-2 overflow-hidden" data-gallery-preview-thumbnails>
                    {[1, 2, 3, 4].map((item) => <div className="grid aspect-[4/3] w-20 shrink-0 place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold" data-gallery-preview-image key={item}>รูปภาพ</div>)}
                  </div>
                  <p className="text-xs font-medium opacity-70">กดรูปแล้วดูรูปใหญ่ · รูปด้านล่างอยู่ในหมวดเดียวกัน</p>
                </div>
              ) : (
                <div className="grid gap-4 p-4" data-gallery-preview-categories>
                  <div className="flex gap-2 overflow-hidden">{["รูปปก (1)", "ภายนอก (8)", "ห้องนอน (6)"].map((label) => <span className="shrink-0 rounded-full border border-current/25 bg-current/10 px-3 py-1.5 text-xs font-semibold" key={label}>{label}</span>)}</div>
                  <div className="grid gap-2"><div className="flex items-center justify-between text-xs font-semibold"><span>ภายนอก</span><span className="opacity-60">8 รูป</span></div><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((item) => <div className="grid aspect-[4/3] place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold" data-gallery-preview-image key={item}>รูปภาพ</div>)}</div></div>
                  <div className="grid gap-2"><div className="flex items-center justify-between text-xs font-semibold"><span>ห้องนอน</span><span className="opacity-60">6 รูป</span></div><div className="grid grid-cols-2 gap-2">{[1, 2].map((item) => <div className="grid aspect-[5/3] place-items-center rounded-md border border-current/20 bg-current/10 text-[10px] font-semibold" data-gallery-preview-image key={item}>รูปภาพ</div>)}</div></div>
                  <p className="text-xs font-medium opacity-70">เลือกหมวดก่อน แล้วกดรูปเพื่อดูแบบใหญ่</p>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </section>
  );
});

export const GalleryStyleEditor = forwardRef<
  GalleryStyleEditorHandle,
  GalleryStyleEditorProps
>(function GalleryStyleEditor({ onSaveStateChange }, ref) {
  return (
    <SettingsDirtyStateProvider>
      <GalleryStyleEditorContent
        onSaveStateChange={onSaveStateChange}
        ref={ref}
      />
    </SettingsDirtyStateProvider>
  );
});

GalleryStyleEditor.displayName = "GalleryStyleEditor";
