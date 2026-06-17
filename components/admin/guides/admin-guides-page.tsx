"use client";

import {
  Bold,
  CheckCircle2,
  CheckSquare,
  Eye,
  ExternalLink,
  FileText,
  Heading2,
  Image as ImageIcon,
  Italic,
  LayoutPanelLeft,
  Link2,
  List,
  Palette,
  Plus,
  Quote,
  Save,
  Trash2,
  Underline,
  Unlink,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Mark, mergeAttributes } from "@tiptap/core";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  getAdminErrorMessage,
} from "@/components/admin/admin-error-messages";
import {
  extractAdminErrors as extractErrors,
  readJsonPayload,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { AdminGuidesSkeleton } from "@/components/admin/loading/admin-guides-skeleton";
import { useAdminSidebarCollapsed } from "@/components/admin/layout/admin-sidebar-preference";
import type {
  GuideDraft,
  GuideImage,
  GuidePost,
  GuideStatus,
} from "@/lib/guides/types";
import {
  createSlugFromTitle,
  validateGuideDraft,
  validateGuideUploadMetadata,
} from "@/lib/guides/validation";
import {
  formatCommaSeparatedInput,
  parseCommaSeparatedTags,
  parseRecommendedHouseIdsInput,
} from "./guide-input-helpers";
import {
  EDITOR_BLOCK_TYPES,
  createEditableDraftId as makeDraftId,
  createEditableTextBlock as makeTextBlock,
  type EditableBlock,
  type EditableBlockType,
  getEditorBlockMeta,
  guideBlocksToTipTapDocument,
  normalizeEditableBlocks as normalizeBlocks,
  type TipTapDocument,
  tipTapDocumentToGuideBlocks,
} from "./guide-editor-helpers";

type AdminGuideDraft = GuideDraft & {
  createdAt?: string;
  draftId: string;
  id?: string;
  updatedAt?: string;
};

interface AdminGuidesResponse {
  guides: GuidePost[];
}

interface AdminGuideResponse {
  guide: GuidePost;
}

const BLOCK_TYPE_ICONS: Record<
  (typeof EDITOR_BLOCK_TYPES)[number],
  typeof FileText
> = {
  paragraph: FileText,
  heading: Heading2,
  bulletListItem: List,
  checkListItem: CheckSquare,
  quote: Quote,
};

const BLOCK_TYPES = EDITOR_BLOCK_TYPES.map((type) => ({
  icon: BLOCK_TYPE_ICONS[type],
  label: getEditorBlockMeta(type).label,
  type,
}));

const DEFAULT_EDITOR_TEXT_COLOR = "#063f35";
const EDITOR_TEXT_COLOR_SWATCHES = [
  "#000000",
  "#404040",
  "#666666",
  "#808080",
  "#a6a6a6",
  "#bfbfbf",
  "#d9d9d9",
  "#f2f2f2",
  "#ffffff",
  "#c00000",
  "#ff0000",
  "#ffc000",
  "#ffff00",
  "#92d050",
  "#00b050",
  "#00b0f0",
  "#0070c0",
  "#002060",
  "#7030a0",
  "#ff00ff",
  "#f4cccc",
  "#fce5cd",
  "#fff2cc",
  "#d9ead3",
  "#d0e0e3",
  "#cfe2f3",
  "#d9d2e9",
  "#ead1dc",
  "#063f35",
  "#0f5a66",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#111827",
] as const;

const UnderlineMark = Mark.create({
  name: "underline",
  parseHTML() {
    return [
      { tag: "u" },
      { style: "text-decoration-line=underline" },
      { style: "text-decoration=underline" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        style: "text-decoration-line: underline;",
      }),
      0,
    ];
  },
});

const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          return typeof attributes.color === "string" && attributes.color
            ? { style: `color: ${attributes.color}` }
            : {};
        },
      },
    };
  },
  parseHTML() {
    return [{ style: "color" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

function getEditorTextColor(editor: Editor): string {
  const color = editor.getAttributes("textColor").color;

  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)
    ? color
    : DEFAULT_EDITOR_TEXT_COLOR;
}

function isSafeEditorTextColor(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    !value.includes(";") &&
    !value.includes("<") &&
    !value.includes(">") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function normalizeEditorTextColorInput(value: string): string | null {
  const color = value.trim();

  return isSafeEditorTextColor(color) ? color : null;
}

function normalizeHexColor(value: string): string | null {
  const color = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color.toLowerCase()}`;
  }

  return null;
}

function getRgbFromHexColor(value: string) {
  const color = normalizeHexColor(value) ?? DEFAULT_EDITOR_TEXT_COLOR;

  return {
    b: Number.parseInt(color.slice(5, 7), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    hex: color,
    r: Number.parseInt(color.slice(1, 3), 16),
  };
}

function getEditorToolbarButtonClass(isActive: boolean) {
  return `inline-flex size-9 items-center justify-center rounded-md border transition ${
    isActive
      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
      : "border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
  }`;
}

function TextColorControl({ editor }: { editor: Editor }) {
  const currentColor = getEditorTextColor(editor);
  const currentRgb = getRgbFromHexColor(currentColor);
  const [isOpen, setIsOpen] = useState(false);
  const modalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const pageWidth = document.documentElement.clientWidth;
    const scrollbarWidth =
      pageWidth > 0 ? Math.max(0, window.innerWidth - pageWidth) : 0;

    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(window.getComputedStyle(document.body).paddingRight) ||
        0;
      document.body.style.paddingRight = `${
        currentPaddingRight + scrollbarWidth
      }px`;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  function applyColor(value: string) {
    const normalizedColor = normalizeEditorTextColorInput(value);

    if (!normalizedColor) {
      return;
    }

    editor.chain().focus().setMark("textColor", { color: normalizedColor }).run();
    setIsOpen(false);
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        aria-expanded={isOpen}
        aria-label="กำหนดสีข้อความ"
        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
        data-guide-mark-type="textColor"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          setIsOpen(true);
        }}
        title="กำหนดสีข้อความ"
        type="button"
      >
        <Palette
          aria-hidden="true"
          className="size-4"
          style={{ color: currentColor }}
        />
      </button>
      {modalRoot && isOpen
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-4 py-6"
              role="dialog"
            >
              <div className="pointer-events-auto max-h-[calc(100vh-3rem)] w-full max-w-[330px] overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--site-border)] bg-white p-4 shadow-2xl ring-1 ring-black/5">
                <div className="grid gap-3">
                <div className="grid grid-cols-10 gap-1.5">
                  {EDITOR_TEXT_COLOR_SWATCHES.map((color) => {
                    const isSelected = color.toLowerCase() === currentRgb.hex;

                    return (
                      <button
                        aria-label={`ใช้สี ${color}`}
                        className={`grid size-5 place-items-center rounded-full border text-[10px] font-bold text-white shadow-sm ${
                          isSelected
                            ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white"
                            : "border-black/10 hover:ring-1 hover:ring-black/20"
                        }`}
                        data-guide-color-swatch="true"
                        key={color}
                        onClick={() => {
                          applyColor(color);
                        }}
                        style={{ backgroundColor: color }}
                        title={color}
                        type="button"
                      >
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--site-muted)]">
                  สีที่กำหนดเอง
                </p>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="ใช้สีปัจจุบัน"
                    className="size-6 rounded-full border border-[var(--site-border-strong)]"
                    onClick={() => {
                      applyColor(currentRgb.hex);
                    }}
                    style={{ backgroundColor: currentRgb.hex }}
                    type="button"
                  />
                  <label
                    aria-label="เพิ่มสี"
                    className="relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--site-border-strong)] text-[var(--site-primary)] focus-within:ring-2 focus-within:ring-[var(--site-primary)]/20"
                    data-guide-color-custom-open="true"
                    title="เพิ่มสี"
                  >
                    <Plus aria-hidden="true" className="pointer-events-none size-4" />
                    <input
                      aria-label="เลือกสีข้อความ"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      data-guide-color-picker="true"
                      onChange={(event) => {
                        applyColor(event.currentTarget.value);
                      }}
                      type="color"
                      value={currentRgb.hex}
                    />
                  </label>
                  <button
                    className="ml-auto text-xs font-semibold text-[var(--site-muted)] hover:text-[var(--site-primary)]"
                    onClick={() => {
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    ปิด
                  </button>
                </div>
              </div>
              </div>
            </div>,
          modalRoot,
        )
        : null}
    </div>
  );
}
function toAdminGuide(post: GuidePost): AdminGuideDraft {
  return {
    id: post.id,
    draftId: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    contentBlocks: normalizeBlocks(post.contentBlocks),
    tags: post.tags,
    recommendedHouseIds: post.recommendedHouseIds,
    status: post.status,
    isPinned: post.isPinned,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function makeNewGuide(existingGuides: AdminGuideDraft[]): AdminGuideDraft {
  const number = existingGuides.length + 1;

  return {
    draftId: makeDraftId(),
    title: `บทความใหม่ ${number}`,
    slug: "",
    excerpt: "",
    coverImage: null,
    contentBlocks: [makeTextBlock("paragraph", "")],
    tags: [],
    recommendedHouseIds: [],
    status: "draft",
    isPinned: false,
    publishedAt: null,
  };
}

function makeSnapshot(guides: AdminGuideDraft[]) {
  return JSON.stringify(guides);
}

function getStatusLabel(status: GuideStatus) {
  return status === "published" ? "เผยแพร่" : "ฉบับร่าง";
}

/**
 * Render an aside list of guide drafts showing status, pinned badge, title, slug preview, and counts.
 *
 * @param activeDraftId - The `draftId` of the currently selected guide or `null` when none is selected.
 * @param guides - Array of guide drafts to display.
 * @param onSelect - Called with a guide's `draftId` when the corresponding list item is clicked.
 * @returns A JSX element rendering the guide list sidebar.
 */
function GuideList({
  activeDraftId,
  guides,
  onSelect,
}: {
  activeDraftId: string | null;
  guides: AdminGuideDraft[];
  onSelect: (draftId: string) => void;
}) {
  return (
    <aside className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      <div className="border-b border-[var(--site-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--site-text)]">
              รายการบทความ
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
              เลือกบทความเพื่อแก้ไขหรือดูสถานะการเผยแพร่
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--site-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-primary)]">
            {guides.length} รายการ
          </span>
        </div>
      </div>
      <div className="grid max-h-[680px] gap-2 overflow-y-auto p-3">
        {guides.map((guide) => {
          const isActive = guide.draftId === activeDraftId;

          return (
            <button
              className={`min-w-0 rounded-lg border px-3 py-3 text-left shadow-sm transition ${
                isActive
                  ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] ring-1 ring-[var(--site-primary)]/10"
                  : "border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-primary)]/35 hover:bg-[var(--site-surface-soft)]"
              }`}
              key={guide.draftId}
              onClick={() => {
                onSelect(guide.draftId);
              }}
              type="button"
            >
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 ${
                    guide.status === "published"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  }`}
                >
                  {getStatusLabel(guide.status)}
                </span>
                {guide.isPinned ? (
                  <span className="rounded-full bg-[var(--site-primary)] px-2.5 py-1 text-[10px] text-[var(--site-on-primary)]">
                    ปักหมุด
                  </span>
                ) : null}
              </span>
              <span className="mt-3 line-clamp-2 block text-sm font-semibold leading-6 text-[var(--site-text)]">
                {guide.title || "ยังไม่ตั้งชื่อ"}
              </span>
              <span className="mt-2 block truncate text-xs text-[var(--site-muted)]">
                /guides/{createSlugFromTitle(guide.title)}
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--site-muted)]">
                <span className="truncate">
                  {guide.recommendedHouseIds.length} บ้านพักแนะนำ
                </span>
                <span className="shrink-0">{guide.tags.length} แท็ก</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function readContentEditableText(node: HTMLElement): string {
  return (node.textContent ?? "").replace(/\u00a0/g, " ");
}

function insertPlainTextAtSelection(text: string) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const textNode = document.createTextNode(text);

  range.deleteContents();
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function EditablePlainTextField({
  ariaLabel,
  className,
  placeholder,
  value,
  onChange,
}: {
  ariaLabel: string;
  className: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = editorRef.current;

    if (!node || document.activeElement === node) {
      return;
    }

    if (readContentEditableText(node) !== value) {
      node.textContent = value;
    }
  }, [value]);

  return (
    <div className="relative min-w-0">
      {value.trim().length === 0 ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 text-[var(--site-muted)]/70 ${className}`}
        >
          {placeholder}
        </span>
      ) : null}
      <div
        aria-label={ariaLabel}
        className={className}
        contentEditable
        onInput={(event) => {
          onChange(readContentEditableText(event.currentTarget));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          insertPlainTextAtSelection(event.clipboardData.getData("text/plain"));
          onChange(readContentEditableText(event.currentTarget));
        }}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
        tabIndex={0}
      />
    </div>
  );
}

function isFormatActive(editor: Editor, type: EditableBlockType): boolean {
  switch (type) {
    case "heading":
      return editor.isActive("heading", { level: 2 });
    case "bulletListItem":
      return editor.isActive("bulletList");
    case "checkListItem":
      return editor.isActive("taskList");
    case "quote":
      return editor.isActive("blockquote");
    default:
      return editor.isActive("paragraph");
  }
}

/**
 * Apply a block-level format to the given editor corresponding to the specified editable block type.
 *
 * @param type - The block type to apply. Supported values:
 *   - `"heading"`: set a level-2 heading
 *   - `"bulletListItem"`: toggle a bulleted list
 *   - `"checkListItem"`: toggle a task (check) list
 *   - `"quote"`: toggle a blockquote
 *   - any other value: set a paragraph
 */
function applyEditorFormat(editor: Editor, type: EditableBlockType) {
  const chain = editor.chain().focus();

  switch (type) {
    case "heading":
      chain.toggleHeading({ level: 2 }).run();
      break;
    case "bulletListItem":
      chain.toggleBulletList().run();
      break;
    case "checkListItem":
      chain.toggleTaskList().run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    default:
      chain.setParagraph().run();
      break;
  }
}

/**
 * Normalize and validate a user-provided link for insertion into the editor.
 *
 * Accepts root-relative paths (starting with `/` but not `//`) and absolute `http://` or `https://` URLs.
 *
 * @param value - The raw link string entered by the user
 * @returns The normalized href string for supported inputs, or `null` if the value is empty or not a supported/valid URL
 */
function normalizeEditorLinkHref(value: string): string | null {
  const href = value.trim();

  if (href.length === 0) {
    return null;
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const url = new URL(href);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Prompt the user for a URL and apply or remove a link mark on the editor selection.
 *
 * If the user provides an empty string the existing link mark is removed. If the input is not a supported href (must start with `/`, `http://`, or `https://`), the user is alerted and no change is made. Valid inputs are normalized before being set as the link href.
 *
 * @param editor - TipTap Editor instance whose current selection will be updated
 */
function applyEditorLink(editor: Editor) {
  const currentHref = editor.getAttributes("link").href;
  const nextHref = window.prompt(
    "ใส่ลิงก์ เช่น /villas/66 หรือ https://example.com",
    typeof currentHref === "string" ? currentHref : "",
  );

  if (nextHref === null) {
    return;
  }

  if (nextHref.trim().length === 0) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  const normalizedHref = normalizeEditorLinkHref(nextHref);

  if (!normalizedHref) {
    window.alert("ลิงก์ต้องขึ้นต้นด้วย /, http:// หรือ https://");
    return;
  }

  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: normalizedHref })
    .run();
}

/**
 * Render a formatting toolbar for a TipTap editor that provides block-type buttons and link attach/remove actions.
 *
 * The toolbar highlights active formats, applies block formatting via the provided editor, and exposes an optional trailing action area.
 *
 * @param editor - TipTap `Editor` instance used to query active formats and apply formatting/link actions
 * @param trailingAction - Optional React node rendered at the end of the toolbar (aligned to the right)
 * @param variant - Layout variant: `"bar"` for a sticky top toolbar or `"bubble"` for a compact rounded bubble
 * @returns A React element containing the toolbar UI
 */
function TipTapFormatToolbar({
  editor,
  trailingAction,
  variant = "bar",
}: {
  editor: Editor;
  trailingAction?: ReactNode;
  variant?: "bar" | "bubble";
}) {
  return (
    <div
      className={
        variant === "bubble"
          ? "grid max-w-[calc(100vw-2rem)] grid-flow-col grid-rows-2 place-content-start gap-1 overflow-x-auto rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-2 shadow-lg sm:flex sm:flex-nowrap sm:items-center sm:rounded-full sm:px-2 sm:py-1"
          : "sticky top-0 grid grid-flow-col grid-rows-2 place-content-start gap-2 overflow-x-auto border-b border-[var(--site-border)] bg-[var(--site-surface)]/95 px-4 py-3 backdrop-blur sm:flex sm:flex-nowrap sm:items-center"
      }
      data-guide-toolbar={variant}
    >
      {BLOCK_TYPES.map((blockType) => {
        const Icon = blockType.icon;
        const isActive = isFormatActive(editor, blockType.type);

        return (
          <button
            aria-label={blockType.label}
            className={getEditorToolbarButtonClass(isActive)}
            data-guide-format-type={blockType.type}
            key={blockType.type}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              applyEditorFormat(editor, blockType.type);
            }}
            title={blockType.label}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
      <button
        aria-label="ตัวหนา"
        className={getEditorToolbarButtonClass(editor.isActive("bold"))}
        data-guide-mark-type="bold"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          editor.chain().focus().toggleBold().run();
        }}
        title="ตัวหนา"
        type="button"
      >
        <Bold aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="ตัวเอียง"
        className={getEditorToolbarButtonClass(editor.isActive("italic"))}
        data-guide-mark-type="italic"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
        }}
        title="ตัวเอียง"
        type="button"
      >
        <Italic aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="ขีดเส้นใต้"
        className={getEditorToolbarButtonClass(editor.isActive("underline"))}
        data-guide-mark-type="underline"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          editor.chain().focus().toggleMark("underline").run();
        }}
        title="ขีดเส้นใต้"
        type="button"
      >
        <Underline aria-hidden="true" className="size-4" />
      </button>
      <TextColorControl editor={editor} />
      <button
        aria-label="แนบลิงก์"
        className={getEditorToolbarButtonClass(editor.isActive("link"))}
        data-guide-link-action="set"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          applyEditorLink(editor);
        }}
        title="แนบลิงก์"
        type="button"
      >
        <Link2 aria-hidden="true" className="size-4" />
      </button>
      {editor.isActive("link") ? (
        <button
          aria-label="เอาลิงก์ออก"
          className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
          data-guide-link-action="unset"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          }}
          title="เอาลิงก์ออก"
          type="button"
        >
          <Unlink aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      {trailingAction ? (
        <div className="shrink-0 sm:ml-auto">{trailingAction}</div>
      ) : null}
    </div>
  );
}

/**
 * Render a TipTap-based rich text editor for guide content with formatting controls and inline image upload.
 *
 * The editor initializes from `blocks`, converts editor changes back to `EditableBlock[]` via `onChange`, and
 * supports inserting uploaded inline images through `onUploadImage`.
 *
 * @param blocks - The current content blocks to load into the editor; editor changes are emitted through `onChange`.
 * @param documentHeader - Node rendered above the editor content (e.g., title/excerpt fields).
 * @param onChange - Called with the updated `EditableBlock[]` whenever the editor content changes.
 * @param onUploadImage - Receives a selected File and should upload it, returning the uploaded `GuideImage` or `null` on failure.
 * @returns The editor UI containing the formatting toolbar, bubble menu, and editable content area.
 */
function BlockEditor({
  blocks,
  documentHeader,
  isDesktopNavCollapsed,
  onChange,
  onUploadImage,
}: {
  blocks: EditableBlock[];
  documentHeader: ReactNode;
  isDesktopNavCollapsed: boolean;
  onChange: (blocks: EditableBlock[]) => void;
  onUploadImage: (file: File) => Promise<GuideImage | null>;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        link: false,
        underline: false,
      }),
      UnderlineMark,
      TextColorMark,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          class: "guide-tiptap-image",
        },
      }),
      LinkExtension.configure({
        autolink: true,
        HTMLAttributes: {
          class: "guide-tiptap-link",
          rel: "noopener noreferrer",
          target: null,
        },
        linkOnPaste: true,
        openOnClick: false,
        validate: (href) => normalizeEditorLinkHref(href) !== null,
      }),
      Placeholder.configure({
        placeholder: "เริ่มเขียน...",
      }),
    ],
    content: guideBlocksToTipTapDocument(blocks),
    editorProps: {
      attributes: {
        class: "guide-tiptap-prose",
      },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate({ editor: nextEditor }) {
      onChange(
        tipTapDocumentToGuideBlocks(nextEditor.getJSON() as TipTapDocument),
      );
    },
  });

  async function uploadInlineImage(file: File) {
    if (!editor) {
      return;
    }

    const image = await onUploadImage(file);

    if (!image) {
      return;
    }

    editor.chain().focus().setImage({ src: image.url, alt: image.alt }).run();
  }

  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      {editor ? (
        <TipTapFormatToolbar
          editor={editor}
          variant="bar"
          trailingAction={
            <label
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              title="เพิ่มรูป"
            >
              <ImageIcon aria-hidden="true" className="size-4" />
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void uploadInlineImage(file);
                  }

                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
          }
        />
      ) : null}

      <div
        className={`guide-tiptap-editor relative grid w-full min-w-0 px-5 py-8 sm:px-8 lg:px-10 ${
          isDesktopNavCollapsed ? "max-w-none" : "mx-auto max-w-3xl"
        }`}
      >
        <div className="mb-7 grid gap-4">{documentHeader}</div>

        {editor ? (
          <>
            <BubbleMenu editor={editor}>
              <TipTapFormatToolbar editor={editor} variant="bubble" />
            </BubbleMenu>
            <EditorContent editor={editor} />
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Renders the right-side status and metadata panel for editing a guide.
 *
 * The panel displays and allows editing of publication status, pinned state,
 * preview route, cover image (upload and alt text), tags, recommended house IDs,
 * and a live card preview. It also exposes actions for uploading a cover image,
 * saving changes, and deleting the guide.
 *
 * @param guide - The current admin guide draft being edited.
 * @param hasUnsavedChanges - Whether the guide has local changes not yet saved.
 * @param isSaving - Whether a save operation is in progress (disables the save button).
 * @param isUploading - Whether an image upload is in progress (disables upload controls).
 * @param onCoverUpload - Called with the selected File when the cover image is uploaded.
 * @param onDelete - Called when the delete action is triggered.
 * @param onSave - Called to persist the current guide (save action).
 * @param onUpdate - Called with a partial set of guide fields to apply local updates.
 * @returns A React element that provides UI for guide status, metadata editing, preview, and actions.
 */
function GuideStatusPanel({
  guide,
  hasUnsavedChanges,
  isSaving,
  isUploading,
  onCoverUpload,
  onDelete,
  onSave,
  onUpdate,
}: {
  guide: AdminGuideDraft;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isUploading: boolean;
  onCoverUpload: (file: File) => void;
  onDelete: () => void;
  onSave: () => void;
  onUpdate: (changes: Partial<AdminGuideDraft>) => void;
}) {
  const [tagsInputText, setTagsInputText] = useState(() =>
    formatCommaSeparatedInput(guide.tags),
  );
  const [houseIdsInputText, setHouseIdsInputText] = useState(() =>
    formatCommaSeparatedInput(guide.recommendedHouseIds),
  );
  const slugPreview = createSlugFromTitle(guide.title);
  const previewHref = `/guides/${slugPreview}`;
  const statusTone =
    guide.status === "published"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";

  return (
    <aside className="grid content-start gap-4">
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--site-text)]">
              สถานะบทความ
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
              จัดการการเผยแพร่ เส้นทางลิงก์ และตำแหน่งแสดงผลของบทความนี้
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 ring-1 ${statusTone}`}
            >
              {getStatusLabel(guide.status)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                hasUnsavedChanges
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              {hasUnsavedChanges
                ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก"
                : "บันทึกล่าสุดแล้ว"}
            </span>
          </div>

          <label className="block text-sm font-medium text-[var(--site-text)]">
            สถานะ
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
              onChange={(event) => {
                onUpdate({ status: event.target.value as GuideStatus });
              }}
              value={guide.status}
            >
              <option value="draft">ฉบับร่าง</option>
              <option value="published">เผยแพร่</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
            <input
              checked={guide.isPinned}
              className="size-4 accent-[var(--site-primary)]"
              onChange={(event) => {
                onUpdate({ isPinned: event.target.checked });
              }}
              type="checkbox"
            />
            ปักหมุดบทความ
          </label>

          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--site-muted)]">
              เส้นทางบทความ
            </p>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--site-text)]">
              /guides/{slugPreview}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              href={previewHref}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              พรีวิว
            </a>
            <button
              aria-label="ลบบทความ"
              className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
              onClick={onDelete}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <p className="text-sm font-bold text-[var(--site-text)]">รูปปก</p>
        <div className="mt-3 overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)]">
          {guide.coverImage?.url ? (
            <Image
              alt={guide.coverImage.alt}
              className="aspect-[16/10] w-full object-cover"
              height={600}
              loading="eager"
              src={guide.coverImage.url}
              unoptimized
              width={960}
            />
          ) : (
            <div className="grid aspect-[16/10] place-items-center text-sm text-[var(--site-muted)]">
              ยังไม่มีรูปปก
            </div>
          )}
        </div>
        <label className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]">
          <Upload aria-hidden="true" className="size-4" />
          {isUploading ? "กำลังอัปโหลด" : "อัปโหลดรูปปก"}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onCoverUpload(file);
              }

              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-[var(--site-text)]">
          คำอธิบายรูป
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              if (!guide.coverImage) {
                return;
              }

              onUpdate({
                coverImage: {
                  ...guide.coverImage,
                  alt: event.target.value,
                },
              });
            }}
            value={guide.coverImage?.alt ?? ""}
          />
        </label>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          แท็ก
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              setTagsInputText(event.target.value);
              onUpdate({ tags: parseCommaSeparatedTags(event.target.value) });
            }}
            placeholder="ครอบครัว,พูลวิลล่าพัทยา,บ้านพักแนะนำ"
            type="text"
            value={tagsInputText}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--site-muted)]">
          คั่นแต่ละแท็กด้วย comma
        </p>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          บ้านพักแนะนำ
          <input
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              setHouseIdsInputText(event.target.value);
              onUpdate({
                recommendedHouseIds: parseRecommendedHouseIdsInput(
                  event.target.value,
                ),
              });
            }}
            placeholder="66,102,901"
            type="text"
            value={houseIdsInputText}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--site-muted)]">
          ใส่รหัสบ้านพักคั่นด้วย comma เช่น 66,102,901
        </p>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            <Eye aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-base font-bold text-[var(--site-text)]">
            ตัวอย่างการ์ดบทความ
          </h2>
        </div>
        <div className="mt-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
          <p className="text-xs font-semibold text-[var(--site-primary)]">
            {guide.tags[0] ?? "บทความ"}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[var(--site-text)]">
            {guide.title || "ยังไม่ตั้งชื่อบทความ"}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--site-muted)]">
            {guide.excerpt || "ยังไม่มีคำโปรย"}
          </p>
          <p className="mt-3 text-xs text-[var(--site-muted)]">
            บ้านพักแนะนำ {guide.recommendedHouseIds.length} หลัง
          </p>
        </div>
      </section>

      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] shadow-md shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
        disabled={isSaving || isUploading || !hasUnsavedChanges}
        onClick={onSave}
        type="button"
      >
        <Save
          aria-hidden="true"
          className={`size-4 ${isSaving ? "animate-pulse" : ""}`}
        />
        {isSaving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </aside>
  );
}

/**
 * Renders the admin UI for managing guide articles, including list navigation,
 * rich content editing, metadata/status controls, image uploads, validation,
 * and save/delete actions.
 *
 * The page handles loading guides from the authenticated API, detects unsaved
 * changes, uploads cover/inline images, validates drafts before saving, and
 * persists updates via authenticated requests. UI is split into a left guide
 * list, a central editor (Tiptap) and a right-side status/metadata panel.
 *
 * @returns The Admin Guides management page as a React element.
 */
export function AdminGuidesPage() {
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const router = useRouter();
  const [guides, setGuides] = useState<AdminGuideDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const activeGuide = useMemo(
    () =>
      guides.find((guide) => guide.draftId === activeDraftId) ??
      guides[0] ??
      null,
    [activeDraftId, guides],
  );
  const currentSnapshot = useMemo(() => makeSnapshot(guides), [guides]);
  const hasUnsavedChanges =
    savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const activePreviewHref = activeGuide
    ? `/guides/${createSlugFromTitle(activeGuide.title)}`
    : null;

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const token = await readAdminAccessToken();

    if (!token) {
      redirectToLogin();
      return null;
    }

    return token;
  }, [redirectToLogin]);

  const loadGuides = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);

      try {
        const response = await fetch("/api/admin/guides", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonPayload(response);

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          setErrors(extractErrors(payload, "โหลดบทความไม่ได้"));
          return;
        }

        const mappedGuides = (
          (payload as AdminGuidesResponse).guides ?? []
        ).map(toAdminGuide);
        const initialGuides =
          mappedGuides.length > 0 ? mappedGuides : [makeNewGuide([])];

        setGuides(initialGuides);
        setActiveDraftId(initialGuides[0]?.draftId ?? null);
        setSavedSnapshot(makeSnapshot(initialGuides));
      } catch (caughtError) {
        setErrors([getAdminErrorMessage(caughtError, "โหลดบทความไม่ได้")]);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const token = await getAccessToken();

      if (!token || !isMounted) {
        return;
      }

      await loadGuides(token, true);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadGuides]);

  function updateActiveGuide(changes: Partial<AdminGuideDraft>) {
    if (!activeGuide) {
      return;
    }

    setErrors([]);
    setNotice(null);
    setGuides((currentGuides) =>
      currentGuides.map((guide) =>
        guide.draftId === activeGuide.draftId
          ? { ...guide, ...changes }
          : guide,
      ),
    );
  }

  function addGuide() {
    setErrors([]);
    setNotice(null);
    setGuides((currentGuides) => {
      const guide = makeNewGuide(currentGuides);

      setActiveDraftId(guide.draftId);
      return [guide, ...currentGuides];
    });
  }

  async function uploadGuideImage(file: File, role: "cover" | "inline") {
    const validationErrors = validateGuideUploadMetadata(file.type, file.size);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setNotice(null);
      return null;
    }

    const token = await getAccessToken();

    if (!token) {
      return null;
    }

    const formData = new FormData();
    formData.set("image", file);
    formData.set("role", role);
    formData.set("guideId", activeGuide?.id ?? "");
    formData.set("alt", activeGuide?.title ?? "");

    setIsUploading(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/guides/assets", {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      });
      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return null;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "อัปโหลดรูปบทความไม่ได้"));
        return null;
      }

      return (payload as { image: GuideImage }).image;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCoverUpload(file: File) {
    const image = await uploadGuideImage(file, "cover");

    if (!image) {
      return;
    }

    updateActiveGuide({ coverImage: image });
  }

  async function handleInlineImageUpload(file: File) {
    return uploadGuideImage(file, "inline");
  }

  async function handleSave() {
    if (!activeGuide) {
      return;
    }

    const guideDraft: GuideDraft = {
      title: activeGuide.title,
      slug: createSlugFromTitle(activeGuide.title),
      excerpt: activeGuide.excerpt,
      coverImage: activeGuide.coverImage,
      contentBlocks: normalizeBlocks(activeGuide.contentBlocks),
      tags: activeGuide.tags,
      recommendedHouseIds: activeGuide.recommendedHouseIds,
      status: activeGuide.status,
      isPinned: activeGuide.isPinned,
      publishedAt: activeGuide.publishedAt,
    };
    const validationErrors = validateGuideDraft(guideDraft);

    setErrors(validationErrors);
    setNotice(null);

    if (validationErrors.length > 0) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/guides", {
        body: JSON.stringify({
          guide: {
            ...guideDraft,
            id: activeGuide.id,
            slug: guideDraft.slug,
          },
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "บันทึกบทความไม่ได้"));
        return;
      }

      const savedGuide = toAdminGuide((payload as AdminGuideResponse).guide);

      setGuides((currentGuides) => {
        const nextGuides = currentGuides.map((guide) =>
          guide.draftId === activeGuide.draftId
            ? { ...savedGuide, draftId: savedGuide.id ?? activeGuide.draftId }
            : guide,
        );

        setSavedSnapshot(makeSnapshot(nextGuides));
        return nextGuides;
      });
      setActiveDraftId(savedGuide.id ?? activeGuide.draftId);
      setNotice("บันทึกบทความแล้ว");
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "บันทึกบทความไม่ได้")]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeGuide) {
      return;
    }

    if (!activeGuide.id) {
      setGuides((currentGuides) => {
        const nextGuides = currentGuides.filter(
          (guide) => guide.draftId !== activeGuide.draftId,
        );
        const safeGuides =
          nextGuides.length > 0 ? nextGuides : [makeNewGuide([])];

        setActiveDraftId(safeGuides[0]?.draftId ?? null);
        return safeGuides;
      });
      return;
    }

    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/guides", {
        body: JSON.stringify({
          id: activeGuide.id,
          slug: activeGuide.slug,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = await readJsonPayload(response);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        setErrors(extractErrors(payload, "ลบบทความไม่ได้"));
        return;
      }

      setGuides((currentGuides) => {
        const nextGuides = currentGuides.filter(
          (guide) => guide.draftId !== activeGuide.draftId,
        );
        const safeGuides =
          nextGuides.length > 0 ? nextGuides : [makeNewGuide([])];

        setActiveDraftId(safeGuides[0]?.draftId ?? null);
        setSavedSnapshot(makeSnapshot(safeGuides));
        return safeGuides;
      });
    } catch {
      setErrors(extractErrors(null, "ลบบทความไม่ได้"));
      return;
    }
    setNotice("ลบบทความแล้ว");
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="guidesPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              คู่มือคอนเทนต์
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              จัดการบทความไกด์
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดการบทความสำหรับหน้าไกด์ พร้อมพรีวิวสถานะ รูปปก
              และบ้านพักแนะนำในมุมมองเดียว
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  hasUnsavedChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                {hasUnsavedChanges
                  ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก"
                  : "บันทึกล่าสุดแล้ว"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--site-primary-soft)] px-3 py-1.5 text-[var(--site-primary)] ring-1 ring-[var(--site-primary)]/10">
                <LayoutPanelLeft aria-hidden="true" className="size-3.5" />
                {guides.length} บทความ
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-text)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              onClick={addGuide}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              เพิ่มบทความ
            </button>
            {activePreviewHref ? (
              <a
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
                href={activePreviewHref}
                rel="noreferrer"
                target="_blank"
              >
                <Eye aria-hidden="true" className="size-4" />
                ดูหน้าเว็บจริง
              </a>
            ) : null}

            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              disabled={
                !activeGuide ||
                isSaving ||
                isLoading ||
                isUploading ||
                !hasUnsavedChanges
              }
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save
                aria-hidden="true"
                className={`size-4 ${isSaving ? "animate-pulse" : ""}`}
              />
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
        notice={notice}
      />

      {isLoading ? (
        <AdminGuidesSkeleton />
      ) : (
        <div
          className={`grid min-w-0 gap-6 ${
            isDesktopNavCollapsed
              ? "xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_420px]"
              : "xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_380px]"
          }`}
        >
          <div className="min-w-0 xl:sticky xl:top-36 xl:self-start">
            <GuideList
              activeDraftId={activeGuide?.draftId ?? null}
              guides={guides}
              onSelect={setActiveDraftId}
            />
          </div>

          {activeGuide ? (
            <>
              <main className="min-w-0">
                <BlockEditor
                  key={activeGuide.draftId}
                  blocks={normalizeBlocks(activeGuide.contentBlocks)}
                  documentHeader={
                    <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 ring-1 ${activeGuide.status === "published" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}
                        >
                          {getStatusLabel(activeGuide.status)}
                        </span>
                        {activeGuide.isPinned ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--site-primary)] px-3 py-1.5 text-[10px] text-[var(--site-on-primary)]">
                            ปักหมุด
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <EditablePlainTextField
                          ariaLabel="ชื่อบทความ"
                          className="min-h-[2.75rem] w-full break-words text-3xl font-semibold leading-tight text-[var(--site-text)] outline-none sm:text-4xl"
                          onChange={(title) => {
                            updateActiveGuide({ title });
                          }}
                          placeholder="ชื่อบทความ"
                          value={activeGuide.title}
                        />
                      </div>
                      <div className="mt-3">
                        <EditablePlainTextField
                          ariaLabel="คำโปรยบทความ"
                          className="min-h-[2rem] w-full break-words text-lg leading-8 text-[var(--site-muted)] outline-none focus:text-[var(--site-text)]"
                          onChange={(excerpt) => {
                            updateActiveGuide({ excerpt });
                          }}
                          placeholder="คำโปรยสั้น ๆ ที่ทำให้คนอยากดูบ้านพักต่อ"
                          value={activeGuide.excerpt}
                        />
                      </div>
                    </div>
                  }
                  isDesktopNavCollapsed={isDesktopNavCollapsed}
                  onChange={(contentBlocks) => {
                    updateActiveGuide({ contentBlocks });
                  }}
                  onUploadImage={handleInlineImageUpload}
                />
              </main>

              <div className="min-w-0 xl:col-start-2 2xl:sticky 2xl:top-36 2xl:col-start-auto 2xl:self-start">
                <GuideStatusPanel
                  key={activeGuide.draftId}
                  guide={activeGuide}
                  hasUnsavedChanges={hasUnsavedChanges}
                  isSaving={isSaving}
                  isUploading={isUploading}
                  onCoverUpload={handleCoverUpload}
                  onDelete={handleDelete}
                  onSave={handleSave}
                  onUpdate={updateActiveGuide}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
