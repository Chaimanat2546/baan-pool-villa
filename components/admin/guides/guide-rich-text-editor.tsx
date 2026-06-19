"use client";

import {
  Bold,
  CheckSquare,
  FileText,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Palette,
  Quote,
  Underline,
  Unlink,
} from "lucide-react";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Mark, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  DEFAULT_GUIDE_TEXT_COLOR,
  getGuideTextColorClass,
  getGuideTextColorSwatchClass,
  GUIDE_TEXT_COLOR_SWATCHES,
  normalizeGuideTextColorForStorage,
} from "@/lib/guides/text-colors";
import type { GuideImage } from "@/lib/guides/types";

import {
  EDITOR_BLOCK_TYPES,
  type EditableBlock,
  type EditableBlockType,
  getEditorBlockMeta,
  guideBlocksToTipTapDocument,
  type TipTapDocument,
  tipTapDocumentToGuideBlocks,
} from "./guide-editor-helpers";

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
        class: "underline underline-offset-4",
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
        parseHTML: (element) => {
          const classColor = Array.from(element.classList)
            .find((className) => className.startsWith("guide-text-color-"))
            ?.replace("guide-text-color-", "#");

          return (
            normalizeGuideTextColorForStorage(classColor) ??
            normalizeGuideTextColorForStorage(element.style.color)
          );
        },
        renderHTML: (attributes) => {
          const className = getGuideTextColorClass(attributes.color);

          return className ? { class: className } : {};
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
  const normalizedColor = normalizeGuideTextColorForStorage(color);

  return normalizedColor ?? DEFAULT_GUIDE_TEXT_COLOR;
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
  const currentColorClass = getGuideTextColorClass(currentColor);
  const currentSwatchClass = getGuideTextColorSwatchClass(currentColor);
  const [isOpen, setIsOpen] = useState(false);
  const modalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    document.body.classList.add("guide-modal-open");

    return () => {
      document.body.classList.remove("guide-modal-open");
    };
  }, [isOpen]);

  function applyColor(value: string) {
    const normalizedColor = normalizeGuideTextColorForStorage(value);

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
          className={`size-4 ${currentColorClass ?? ""}`}
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
                    {GUIDE_TEXT_COLOR_SWATCHES.map((color) => {
                      const isSelected = color === currentColor;
                      const swatchClass = getGuideTextColorSwatchClass(color);

                      return (
                        <button
                          aria-label={`ใช้สี ${color}`}
                          className={`grid size-5 place-items-center rounded-full border text-[10px] font-bold text-white shadow-sm ${swatchClass ?? ""} ${
                            isSelected
                              ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white"
                              : "border-black/10 hover:ring-1 hover:ring-black/20"
                          }`}
                          data-guide-color-swatch="true"
                          key={color}
                          onClick={() => {
                            applyColor(color);
                          }}
                          title={color}
                          type="button"
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--site-muted)]">
                    สีที่กำหนดเอง
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="ใช้สีปัจจุบัน"
                      className={`size-6 rounded-full border border-[var(--site-border-strong)] ${currentSwatchClass ?? ""}`}
                      onClick={() => {
                        applyColor(currentColor);
                      }}
                      type="button"
                    />
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

export function EditablePlainTextField({
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

export function BlockEditor({
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
    onUpdate({ editor: nextEditor }) {
      onChange(
        tipTapDocumentToGuideBlocks(nextEditor.getJSON() as TipTapDocument),
      );
    },
    shouldRerenderOnTransaction: true,
  });

  async function uploadInlineImage(file: File) {
    if (!editor) {
      return;
    }

    const image = await onUploadImage(file);

    if (!image) {
      return;
    }

    editor.chain().focus().setImage({ alt: image.alt, src: image.url }).run();
  }

  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      {editor ? (
        <TipTapFormatToolbar
          editor={editor}
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
          variant="bar"
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
