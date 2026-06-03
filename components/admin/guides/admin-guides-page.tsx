"use client";

import {
  CheckSquare,
  FileText,
  Heading2,
  Image as ImageIcon,
  List,
  Plus,
  Quote,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { GuideDraft, GuideImage, GuidePost, GuideStatus } from "@/lib/guides/types";
import {
  createSlugFromTitle,
  validateGuideDraft,
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

const BLOCK_TYPE_ICONS: Record<(typeof EDITOR_BLOCK_TYPES)[number], typeof FileText> = {
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

function extractErrors(payload: unknown, fallback: string): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const errorPayload = payload as {
    code?: unknown;
    details?: unknown;
    error?: unknown;
    errors?: unknown;
    hint?: unknown;
  };

  if (Array.isArray(errorPayload.errors)) {
    const errors = errorPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return errors;
    }
  }

  if (typeof errorPayload.error === "string" && errorPayload.error) {
    const detailParts = [
      typeof errorPayload.code === "string" ? errorPayload.code : null,
      typeof errorPayload.details === "string" ? errorPayload.details : null,
      typeof errorPayload.hint === "string" ? errorPayload.hint : null,
    ].filter(Boolean);

    return [
      detailParts.length > 0
        ? `${errorPayload.error} (${detailParts.join(" / ")})`
        : errorPayload.error,
    ];
  }

  return [fallback];
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getStatusLabel(status: GuideStatus) {
  return status === "published" ? "เผยแพร่" : "ฉบับร่าง";
}

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
    <aside className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="border-b border-[var(--site-border)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--site-text)]">บทความ</p>
        <p className="mt-0.5 text-xs text-[var(--site-muted)]">
          ปักหมุดจะแสดงก่อนในหน้าเว็บ
        </p>
      </div>
      <div className="grid max-h-[640px] gap-1 overflow-y-auto p-2">
        {guides.map((guide) => {
          const isActive = guide.draftId === activeDraftId;

          return (
            <button
              className={`min-w-0 rounded-md border px-3 py-3 text-left transition ${
                isActive
                  ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                  : "border-transparent hover:border-[var(--site-border)] hover:bg-[var(--site-surface-soft)]"
              }`}
              key={guide.draftId}
              onClick={() => {
                onSelect(guide.draftId);
              }}
              type="button"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--site-muted)]">
                {getStatusLabel(guide.status)}
                {guide.isPinned ? (
                  <span className="rounded-full bg-[var(--site-primary)] px-2 py-0.5 text-[10px] text-[var(--site-on-primary)]">
                    ปักหมุด
                  </span>
                ) : null}
              </span>
              <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-[var(--site-text)]">
                {guide.title || "ยังไม่ตั้งชื่อ"}
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--site-muted)]">
                /guides/{createSlugFromTitle(guide.title)}
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

function TipTapFormatToolbar({
  editor,
  variant = "bar",
}: {
  editor: Editor;
  variant?: "bar" | "bubble";
}) {
  return (
    <div
      className={
        variant === "bubble"
          ? "flex items-center gap-1 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2 py-1 shadow-lg"
          : "flex flex-wrap items-center gap-2 border-b border-[var(--site-border)] px-4 py-3"
      }
    >
      {BLOCK_TYPES.map((blockType) => {
        const Icon = blockType.icon;
        const isActive = isFormatActive(editor, blockType.type);

        return (
          <button
            aria-label={blockType.label}
            className={`inline-flex size-9 items-center justify-center rounded-md border transition ${
              isActive
                ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
                : "border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
            }`}
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
    </div>
  );
}

function BlockEditor({
  blocks,
  documentHeader,
  onChange,
  onUploadImage,
}: {
  blocks: EditableBlock[];
  documentHeader: ReactNode;
  onChange: (blocks: EditableBlock[]) => void;
  onUploadImage: (file: File) => Promise<GuideImage | null>;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          class: "guide-tiptap-image",
        },
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
      onChange(tipTapDocumentToGuideBlocks(nextEditor.getJSON() as TipTapDocument));
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
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      {editor ? <TipTapFormatToolbar editor={editor} /> : null}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--site-border)] px-4 pb-3">
        <label
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
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
      </div>

      <div
        className="guide-tiptap-editor relative mx-auto grid w-full min-w-0 max-w-3xl px-5 py-8 sm:px-8 lg:px-10"
      >
        <div className="mb-7 grid gap-4">
          {documentHeader}
        </div>

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

  return (
    <aside className="grid content-start gap-3">
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <div className="flex gap-2">
          <button
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isUploading || !hasUnsavedChanges}
            onClick={onSave}
            type="button"
          >
            <Save aria-hidden="true" className="size-4" />
            บันทึก
          </button>
          <button
            aria-label="ลบบทความ"
            className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 bg-[var(--site-surface)] text-red-700 transition hover:bg-red-50"
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
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

          <div className="rounded-md bg-[var(--site-surface-soft)] px-3 py-2 text-xs text-[var(--site-muted)]">
            /guides/{slugPreview}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--site-text)]">รูปปก</p>
        <div className="mt-3 overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)]">
          {guide.coverImage?.url ? (
            <Image
              alt={guide.coverImage.alt}
              className="aspect-[16/10] w-full object-cover"
              height={600}
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

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
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

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
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

      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--site-text)]">ตัวอย่าง</p>
        <div className="mt-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
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
    </aside>
  );
}

export function AdminGuidesPage() {
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

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserHomeConfigClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (error || !token) {
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

        const mappedGuides = ((payload as AdminGuidesResponse).guides ?? []).map(
          toAdminGuide,
        );
        const initialGuides =
          mappedGuides.length > 0 ? mappedGuides : [makeNewGuide([])];

        setGuides(initialGuides);
        setActiveDraftId(initialGuides[0]?.draftId ?? null);
        setSavedSnapshot(makeSnapshot(initialGuides));
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error ? caughtError.message : "โหลดบทความไม่ได้",
        ]);
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
        guide.draftId === activeGuide.draftId ? { ...guide, ...changes } : guide,
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
            slug: activeGuide.slug,
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
      router.refresh();
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error ? caughtError.message : "บันทึกบทความไม่ได้",
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeGuide) {
      return;
    }

    if (!activeGuide.id) {
      setGuides((currentGuides) =>
        currentGuides.filter((guide) => guide.draftId !== activeGuide.draftId),
      );
      setActiveDraftId(guides[0]?.draftId ?? null);
      return;
    }

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
      const safeGuides = nextGuides.length > 0 ? nextGuides : [makeNewGuide([])];

      setActiveDraftId(safeGuides[0]?.draftId ?? null);
      setSavedSnapshot(makeSnapshot(safeGuides));
      return safeGuides;
    });
    setNotice("ลบบทความแล้ว");
  }

  return (
    <div className="flex w-full flex-col gap-4 text-[var(--site-text)]">
      <header className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--site-muted)]">
              Conversion Travel Guide
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[var(--site-text)]">
              จัดการบทความ
            </h1>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:opacity-92"
            onClick={addGuide}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มบทความ
          </button>
        </div>
      </header>

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">แก้รายการเหล่านี้ก่อนบันทึก:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-8 text-center text-sm text-[var(--site-muted)]">
          กำลังโหลดบทความ...
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(250px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_360px]">
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
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
                  blocks={normalizeBlocks(activeGuide.contentBlocks)}
                  documentHeader={
                    <>
                      <EditablePlainTextField
                        ariaLabel="ชื่อบทความ"
                        className="min-h-[2.75rem] w-full break-words text-3xl font-semibold leading-tight text-[var(--site-text)] outline-none sm:text-4xl"
                        onChange={(title) => {
                          updateActiveGuide({ title });
                        }}
                        placeholder="ชื่อบทความ"
                        value={activeGuide.title}
                      />
                      <div>
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
                    </>
                  }
                  onChange={(contentBlocks) => {
                    updateActiveGuide({ contentBlocks });
                  }}
                  onUploadImage={handleInlineImageUpload}
                />
              </main>

              <div className="min-w-0 xl:col-start-2 2xl:sticky 2xl:top-4 2xl:col-start-auto 2xl:self-start">
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
