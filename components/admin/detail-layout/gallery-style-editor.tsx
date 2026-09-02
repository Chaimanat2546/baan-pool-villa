"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, Images, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { AdminFeedback } from "@/components/admin/admin-feedback";
import { getContrastRatio } from "@/lib/site-settings/colors";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import {
  GALLERY_CATEGORY_LABELS,
  DEFAULT_GALLERY_CATEGORY_ORDER,
} from "@/lib/site-web-styles/gallery-categories";
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

function SortableGalleryCategoryRow({
  categoryKey,
  disabled,
  index,
}: {
  categoryKey: (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number];
  disabled: boolean;
  index: number;
}) {
  const label = GALLERY_CATEGORY_LABELS[categoryKey];
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    disabled,
    id: categoryKey,
  });

  return (
    <li
      ref={setNodeRef}
      className="flex items-center gap-3 rounded-md border border-[var(--site-border)] px-3 py-2"
      data-gallery-category-key={categoryKey}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
    >
      <button
        aria-label={`ลาก${label}เพื่อจัดลำดับ`}
        className="grid size-11 shrink-0 place-items-center rounded-md text-[var(--site-muted)] hover:bg-[var(--site-surface-tint)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        style={{ touchAction: "none" }}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <span className="text-sm font-medium text-[var(--site-text)]">
        {index + 1}. {label}
      </span>
    </li>
  );
}

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
        categoryOrder: settings.categoryOrder ?? DEFAULT_GALLERY_CATEGORY_ORDER,
        showCover: settings.showCover ?? true,
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
  const categoryOrder = draft?.categoryOrder ?? DEFAULT_GALLERY_CATEGORY_ORDER;
  const [categoryOrderDraft, setCategoryOrderDraft] = useState<
    typeof DEFAULT_GALLERY_CATEGORY_ORDER | null
  >(null);
  const [showCoverDraft, setShowCoverDraft] = useState<boolean | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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

  useEffect(() => {
    if (!categoryOrderDraft) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [categoryOrderDraft]);

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

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--site-text)]">
                  ลำดับหมวดรูปภาพ
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
                  ใช้กับบ้านพักทุกหลัง · {categoryOrder.length} หมวด
                </p>
              </div>
              <button
                className="inline-flex min-h-10 items-center rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
                data-open-gallery-category-order
                onClick={() => {
                  setCategoryOrderDraft([...categoryOrder]);
                  setShowCoverDraft(draft.showCover ?? true);
                }}
                type="button"
              >
                จัดลำดับหมวดรูปภาพ
              </button>
            </section>

            <div
              className="grid gap-3 sm:grid-cols-2"
              data-gallery-color-controls="true"
            >
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
      {categoryOrderDraft ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6"
          role="dialog"
        >
          <section
            className="grid max-h-[88dvh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] rounded-t-2xl bg-[var(--site-surface)] shadow-2xl sm:rounded-2xl"
            data-gallery-category-order="true"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--site-border)] px-4 py-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--site-text)]">
                  จัดลำดับหมวดรูปภาพ
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  หมวดที่ไม่มีรูปจะไม่แสดงบนเว็บไซต์
                </p>
              </div>
              <button
                aria-label="ปิดหน้าต่างจัดลำดับหมวดรูปภาพ"
                className="grid size-9 shrink-0 place-items-center rounded-md text-[var(--site-muted)] hover:bg-[var(--site-surface-tint)]"
                onClick={() => {
                  setCategoryOrderDraft(null);
                  setShowCoverDraft(null);
                }}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <DndContext
              accessibility={{
                announcements: {
                  onDragCancel: ({ active }) => `ยกเลิกการลาก ${GALLERY_CATEGORY_LABELS[active.id as (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number]]}`,
                  onDragEnd: ({ active, over }) => over ? `วาง ${GALLERY_CATEGORY_LABELS[active.id as (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number]]} ที่ตำแหน่งใหม่แล้ว` : "ยกเลิกการลาก",
                  onDragOver: ({ active, over }) => over ? `กำลังลาก ${GALLERY_CATEGORY_LABELS[active.id as (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number]]} ผ่าน ${GALLERY_CATEGORY_LABELS[over.id as (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number]]}` : undefined,
                  onDragStart: ({ active }) => `เริ่มลาก ${GALLERY_CATEGORY_LABELS[active.id as (typeof DEFAULT_GALLERY_CATEGORY_ORDER)[number]]}`,
                },
                screenReaderInstructions: {
                  draggable: "ใช้เมาส์ นิ้ว หรือแป้นพิมพ์ลากปุ่มจับเพื่อเปลี่ยนลำดับหมวดรูปภาพ",
                },
              }}
              onDragEnd={(event: DragEndEvent) => {
                if (!event.over || event.active.id === event.over.id) return;
                const activeIndex = categoryOrderDraft.findIndex((id) => id === event.active.id);
                const overIndex = categoryOrderDraft.findIndex((id) => id === event.over?.id);
                if (activeIndex >= 0 && overIndex >= 0) {
                  setCategoryOrderDraft((current) => current ? arrayMove(current, activeIndex, overIndex) : current);
                }
              }}
              sensors={state.isSaving ? [] : sensors}
            >
              <SortableContext items={categoryOrderDraft.filter((categoryKey) => categoryKey !== "cover")} strategy={verticalListSortingStrategy}>
                <ol aria-label="เรียงลำดับหมวดรูปภาพ" className="grid content-start gap-2 overflow-y-auto overscroll-contain px-4 py-4">
                  <li className="flex items-center justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2" data-gallery-category-key="cover">
                    <span className="text-sm font-medium text-[var(--site-text)]">1. {GALLERY_CATEGORY_LABELS.cover}</span>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--site-text)]">
                      <input checked={showCoverDraft ?? true} data-gallery-show-cover disabled={state.isSaving} onChange={(event) => setShowCoverDraft(event.target.checked)} type="checkbox" />
                      แสดงรูปปก
                    </label>
                  </li>
                  {categoryOrderDraft.filter((categoryKey) => categoryKey !== "cover").map((categoryKey, index) => <SortableGalleryCategoryRow categoryKey={categoryKey} disabled={state.isSaving} index={index + 1} key={categoryKey} />)}
                </ol>
              </SortableContext>
            </DndContext>
            <div className="flex justify-end gap-2 border-t border-[var(--site-border)] px-4 py-3">
              <button className="min-h-11 rounded-md px-3 text-sm font-semibold text-[var(--site-text)] hover:bg-[var(--site-surface-tint)] disabled:cursor-not-allowed disabled:opacity-40" data-cancel-gallery-category-order disabled={state.isSaving} onClick={() => { setCategoryOrderDraft(null); setShowCoverDraft(null); }} type="button">ยกเลิก</button>
              <button className="min-h-11 rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)] hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40" data-save-gallery-category-order disabled={state.isSaving} onClick={() => { state.updateDraft({ categoryOrder: categoryOrderDraft, showCover: showCoverDraft ?? true }); setCategoryOrderDraft(null); setShowCoverDraft(null); }} type="button">บันทึกลำดับ</button>
            </div>
          </section>
        </div>
      ) : null}
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
