"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleUserRound,
  ExternalLink,
  GripVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { DragEvent, FormEvent, useState } from "react";

import { useAdminSidebarCollapsed } from "@/components/admin/layout/admin-sidebar-preference";
import {
  HOMEPAGE_TIKTOK_PREVIEW_LIMIT,
  createTikTokRowId,
  isValidPreviewAccountUrl,
  makePreviewVideoRows,
} from "./tiktok-helpers";
import type { AdminTikTokDraft } from "./types";

interface TikTokFormProps {
  draft: AdminTikTokDraft;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onChange: (changes: Partial<AdminTikTokDraft>) => void;
  onSave: () => void;
}

/**
 * Move an element within an array from one index to another and return a new array.
 *
 * @param items - The array to reorder; the original array is not mutated.
 * @param sourceIndex - Zero-based index of the element to move.
 * @param targetIndex - Zero-based index where the element should be inserted.
 * @returns A new array with the element moved from `sourceIndex` to `targetIndex`. If either index is out of bounds or the source element is `undefined`, the original `items` array is returned.
 */
function moveArrayItem<T>(items: T[], sourceIndex: number, targetIndex: number): T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);

  if (movedItem === undefined) {
    return items;
  }

  nextItems.splice(targetIndex, 0, movedItem);

  return nextItems;
}

/**
 * Produce a canonical external TikTok account URL suitable for preview.
 *
 * @param value - A user-provided account string (URL or handle), may include surrounding whitespace
 * @returns The canonical absolute account URL as a string, or `null` if the input is not a valid preview URL or cannot be parsed
 */
function getAccountPreviewHref(value: string): string | null {
  const trimmed = value.trim();

  if (!isValidPreviewAccountUrl(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/**
 * Derives a TikTok handle from a URL-like string or returns a fallback handle.
 *
 * If `value` is empty after trimming, returns the default handle `@baanpoolvilla_official`.
 * If `value` parses as a URL and its first path segment that starts with `@` exists, that segment is returned.
 * Otherwise, the trimmed input string is returned unchanged.
 *
 * @param value - Raw or URL-like input that may contain a TikTok handle
 * @returns The TikTok handle (for example `@username`), the trimmed input when no handle is found, or `@baanpoolvilla_official` when `value` is empty
 */
function getTikTokHandle(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "@baanpoolvilla_official";
  }

  try {
    const parsed = new URL(trimmed);
    const handle = parsed.pathname
      .split("/")
      .find((part) => part.startsWith("@"));

    return handle || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Produce a user-facing label for a TikTok video input.
 *
 * If `value` is empty, returns `video/{fallbackIndex + 1}`. If `value` is a TikTok URL
 * containing `.../video/{id}` or the embed path `player/v1/{id}`, returns `video/{id}`.
 * Otherwise returns the trimmed `value`.
 *
 * @param value - The raw or URL-like video input
 * @param fallbackIndex - Index used to generate a default label when `value` is empty
 * @returns The computed video label (e.g. `video/123456` or `video/1`)
 */
function getTikTokVideoLabel(value: string, fallbackIndex: number): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return `video/${fallbackIndex + 1}`;
  }

  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const videoIndex = parts.findIndex((part) => part === "video");

    if (videoIndex >= 0 && parts[videoIndex + 1]) {
      return `video/${parts[videoIndex + 1]}`;
    }

    if (parts[0] === "player" && parts[1] === "v1" && parts[2]) {
      return `video/${parts[2]}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

/**
 * Validates and canonicalizes a TikTok video URL for use as a preview link.
 *
 * @param value - The input URL or text to validate and normalize
 * @returns The canonical `https` TikTok URL string when `value` is a valid TikTok link, `null` otherwise
 */
function getVideoPreviewHref(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (
      parsed.protocol !== "https:" ||
      !["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(parsed.hostname)
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Convert a TikTok video URL or raw input into a canonical TikTok player embed URL.
 *
 * @param value - The URL-like or raw input that may contain a TikTok video id or path
 * @returns The TikTok player embed URL for the extracted numeric video id, or `null` if the input is empty, not an `https` TikTok URL (tiktok.com, www.tiktok.com, m.tiktok.com), or does not contain a numeric video id
 */
function getTikTokPlayerHref(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (
      parsed.protocol !== "https:" ||
      !["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(parsed.hostname)
    ) {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const videoIndex = parts.findIndex((part) => part === "video");
    const playerIndex = parts.findIndex((part) => part === "v1");
    const videoId =
      videoIndex >= 0 ? parts[videoIndex + 1] : playerIndex >= 0 ? parts[playerIndex + 1] : null;

    if (!videoId || !Array.from(videoId).every((character) => character >= "0" && character <= "9")) {
      return null;
    }

    return `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?controls=1&rel=0`;
  } catch {
    return null;
  }
}

/**
 * Focuses the video URL input corresponding to a specific row.
 *
 * @param rowId - Row identifier used to construct the input element id `tiktokVideoUrl-{rowId}`
 */
function focusVideoInput(rowId: string) {
  document.getElementById(`tiktokVideoUrl-${rowId}`)?.focus();
}

/**
 * Append a new empty video row to the TikTok draft.
 *
 * @returns The same `draft` object shape with a new row id appended to `videoRowIds` and an empty string appended to `videoUrls`; other fields are preserved.
 */
export function addTikTokVideoRow(draft: AdminTikTokDraft): AdminTikTokDraft {
  return {
    ...draft,
    videoRowIds: [...draft.videoRowIds, createTikTokRowId()],
    videoUrls: [...draft.videoUrls, ""],
  };
}

/**
 * Update or append a video URL in a TikTok draft at the specified index.
 *
 * @param draft - The draft containing `videoUrls` and `videoRowIds`.
 * @param index - The index to update; if `index` is greater than or equal to the current length, the `nextValue` is appended as a new row and a new row id is generated.
 * @param nextValue - The video URL to set for the row.
 * @returns The updated draft with new `videoUrls` (and `videoRowIds` if a row was appended). The original `draft` is not mutated.
 */
export function updateTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
  nextValue: string,
): AdminTikTokDraft {
  const nextVideoUrls = [...draft.videoUrls];
  const nextVideoRowIds = [...draft.videoRowIds];

  if (index >= nextVideoUrls.length) {
    nextVideoUrls.push(nextValue);
    nextVideoRowIds.push(createTikTokRowId());
  } else {
    nextVideoUrls[index] = nextValue;
  }

  return {
    ...draft,
    videoUrls: nextVideoUrls,
    videoRowIds: nextVideoRowIds,
  };
}

/**
 * Remove the video row at the specified index from the draft.
 *
 * @param draft - The current TikTok draft to update.
 * @param index - Zero-based index of the video row to remove.
 * @returns The updated draft with the `videoUrls` and `videoRowIds` entries at `index` removed.
 */
export function deleteTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
): AdminTikTokDraft {
  return {
    ...draft,
    videoUrls: draft.videoUrls.filter((_, existingIndex) => existingIndex !== index),
    videoRowIds: draft.videoRowIds.filter((_, existingIndex) => existingIndex !== index),
  };
}

/**
 * Move a video row in the draft one position up or down.
 *
 * Reorders `videoUrls` and `videoRowIds` by moving the element at `index`
 * to `index + direction`, preserving the rest of the draft unchanged.
 *
 * @param draft - The current TikTok draft to update
 * @param index - The zero-based index of the row to move
 * @param direction - `-1` to move the row up, `1` to move the row down
 * @returns A new `AdminTikTokDraft` with `videoUrls` and `videoRowIds` reordered
 */
export function moveTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
  direction: -1 | 1,
): AdminTikTokDraft {
  const nextVideoUrls = moveArrayItem(draft.videoUrls, index, index + direction);
  const nextVideoRowIds = moveArrayItem(draft.videoRowIds, index, index + direction);

  return {
    ...draft,
    videoRowIds: nextVideoRowIds,
    videoUrls: nextVideoUrls,
  };
}

/**
 * Reorders draft's video rows by moving the item at `sourceIndex` to `targetIndex`.
 *
 * @param draft - The admin TikTok draft to update.
 * @param sourceIndex - Zero-based index of the row to move.
 * @param targetIndex - Zero-based index to move the row to.
 * @returns A new draft with `videoUrls` and `videoRowIds` updated to reflect the move. If the provided indices are invalid or the moved element is undefined, the original draft is returned unchanged.
 */
export function moveTikTokVideoRowToIndex(
  draft: AdminTikTokDraft,
  sourceIndex: number,
  targetIndex: number,
): AdminTikTokDraft {
  const nextVideoUrls = moveArrayItem(draft.videoUrls, sourceIndex, targetIndex);
  const nextVideoRowIds = moveArrayItem(draft.videoRowIds, sourceIndex, targetIndex);

  return {
    ...draft,
    videoRowIds: nextVideoRowIds,
    videoUrls: nextVideoUrls,
  };
}

/**
 * Renders an admin form for editing a TikTok account link and an ordered list of TikTok video URLs, including controls for add/edit/delete, drag-and-drop reordering, and a live preview iframe.
 *
 * @param draft - The current draft data for the TikTok form (account URL, videoUrls, videoRowIds).
 * @param hasUnsavedChanges - Whether the draft has unsaved changes; used to annotate the form state.
 * @param isSaving - Whether a save operation is in progress; used to set the form busy state.
 * @param onChange - Callback invoked with an updated draft when the user modifies the form.
 * @param onSave - Callback invoked when the form is submitted.
 * @returns The rendered form element for the TikTok admin UI.
 */
export function TikTokForm({
  draft,
  hasUnsavedChanges,
  isSaving,
  onChange,
  onSave,
}: TikTokFormProps) {
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const [draggingVideoIndex, setDraggingVideoIndex] = useState<number | null>(null);
  const [activePreviewVideoUrl, setActivePreviewVideoUrl] = useState<string | null>(null);
  const rows = makePreviewVideoRows(draft.videoUrls, draft.videoRowIds);
  const normalizedRows = draft.videoUrls.map((url) => url.trim()).filter(Boolean);
  const visibleRows = rows.filter((row) => row.url.trim().length > 0);
  const visibleCount = Math.min(HOMEPAGE_TIKTOK_PREVIEW_LIMIT, visibleRows.length);
  const accountPreview = getAccountPreviewHref(draft.accountUrl);
  const activePreviewPlayerHref = getTikTokPlayerHref(activePreviewVideoUrl ?? "");

  function handleVideoUpdate(index: number, nextValue: string) {
    onChange(updateTikTokVideoRow(draft, index, nextValue));
  }

  function handleAddVideo() {
    const nextDraft = addTikTokVideoRow(draft);
    const nextRowId = nextDraft.videoRowIds.at(-1);

    onChange(nextDraft);

    if (nextRowId) {
      window.requestAnimationFrame(() => {
        focusVideoInput(nextRowId);
      });
    }
  }

  function handleDeleteVideo(index: number) {
    if (index >= draft.videoUrls.length) {
      return;
    }

    onChange(deleteTikTokVideoRow(draft, index));
  }

  function handleMoveVideo(index: number, direction: -1 | 1) {
    const nextVideo = moveTikTokVideoRow(draft, index, direction);
    const isNoop = nextVideo.videoUrls === draft.videoUrls;

    if (isNoop) {
      return;
    }

    onChange(nextVideo);
  }

  function handleVideoDragStart(
    event: DragEvent<HTMLDivElement>,
    index: number,
  ) {
    setDraggingVideoIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleVideoDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleVideoDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();

    const rawSourceIndex = event.dataTransfer.getData("text/plain");
    const sourceIndex =
      rawSourceIndex.length > 0 ? Number(rawSourceIndex) : draggingVideoIndex;

    setDraggingVideoIndex(null);

    if (sourceIndex === null) {
      return;
    }

    if (
      !Number.isInteger(sourceIndex) ||
      sourceIndex === targetIndex ||
      sourceIndex < 0 ||
      sourceIndex >= draft.videoUrls.length
    ) {
      return;
    }

    onChange(moveTikTokVideoRowToIndex(draft, sourceIndex, targetIndex));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <form
      aria-busy={isSaving}
      className={`grid min-w-0 gap-6 ${
        isDesktopNavCollapsed
          ? "xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]"
          : "xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
      }`}
      data-unsaved={hasUnsavedChanges ? "true" : "false"}
      onSubmit={handleSubmit}
    >
      <div className="grid min-w-0 content-start gap-6">
        <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
              <CircleUserRound aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--site-text)]">บัญชี TikTok</h2>
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                แก้ลิงก์บัญชีได้จากช่องนี้ ปุ่มเปิดบัญชีจะใช้ลิงก์ล่าสุดในช่องเสมอ
              </p>
              <div className="mt-5 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <p className="text-sm text-[var(--site-muted)]">บัญชี TikTok</p>
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--site-text)]">
                  {getTikTokHandle(draft.accountUrl)}
                </p>
                {accountPreview ? (
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                    href={accountPreview}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    เปิด TikTok
                  </a>
                ) : (
                  <span className="hidden lg:block" />
                )}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <label
                  className="text-sm text-[var(--site-muted)]"
                  htmlFor="tiktokAccountUrl"
                >
                  ลิงก์บัญชี
                </label>
                <input
                  className="h-10 min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm font-medium text-[var(--site-primary)] outline-none transition placeholder:text-[var(--site-muted)] focus:border-[var(--site-border)] focus:bg-[var(--site-surface-soft)] focus:px-3 focus:ring-2 focus:ring-[var(--site-primary)]/15"
                  id="tiktokAccountUrl"
                  onChange={(event) => {
                    onChange({ accountUrl: event.target.value });
                  }}
                  placeholder="https://www.tiktok.com/@baanpoolvilla"
                  value={draft.accountUrl}
                />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
                  onClick={() => {
                    document.getElementById("tiktokAccountUrl")?.focus();
                  }}
                  type="button"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                  แก้บัญชี
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-start gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                <Video aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--site-text)]">วิดีโอ TikTok</h2>
                <p className="mt-1 text-sm text-[var(--site-muted)]">
                  วิดีโอ {normalizedRows.length} รายการ เรียงตามลำดับที่จะแสดงบนหน้าแรก
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] shadow-md shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)]"
              id="addTikTokVideoRow"
              onClick={handleAddVideo}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              เพิ่มวิดีโอ
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {rows.map((row, index) => {
              const videoHref = getVideoPreviewHref(row.url);
              const playerHref = getTikTokPlayerHref(row.url);
              const canDrag = draft.videoUrls.length > 1;

              return (
                <div
                  aria-grabbed={draggingVideoIndex === index}
                  className={`grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm transition md:grid-cols-[24px_48px_112px_minmax(0,1fr)] md:items-center 2xl:grid-cols-[24px_48px_112px_minmax(0,1fr)_auto_auto] ${
                    draggingVideoIndex === index
                      ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
                      : ""
                  }`}
                  draggable={canDrag}
                  key={row.id}
                  onDragEnd={() => {
                    setDraggingVideoIndex(null);
                  }}
                  onDragOver={handleVideoDragOver}
                  onDragStart={(event) => {
                    handleVideoDragStart(event, index);
                  }}
                  onDrop={(event) => {
                    handleVideoDrop(event, index);
                  }}
                >
                  <span
                    aria-label={`ลากเพื่อเรียงลำดับวิดีโอ TikTok ${index + 1}`}
                    className="hidden cursor-grab text-[var(--site-muted)] active:cursor-grabbing lg:inline-flex"
                    role="button"
                    title={`ลากเพื่อเรียงลำดับวิดีโอ TikTok ${index + 1}`}
                  >
                    <GripVertical aria-hidden="true" className="size-5" />
                  </span>
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-sm font-bold text-[var(--site-primary)]">
                    #{index + 1}
                  </span>
                  <div className="relative h-20 overflow-hidden rounded-md bg-[linear-gradient(135deg,#c7d2fe,#bfdbfe_45%,#fef3c7)] shadow-inner">
                    {playerHref ? (
                      <button
                        aria-label={`ดูคลิปวิดีโอ TikTok ${index + 1}`}
                        className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.75),transparent_28%),linear-gradient(160deg,transparent_45%,rgba(15,23,42,.22))]"
                        data-preview-video-id={row.id}
                        onClick={() => {
                          setActivePreviewVideoUrl(row.url);
                        }}
                        title={`ดูคลิปวิดีโอ TikTok ${index + 1}`}
                        type="button"
                      >
                        <span className="inline-flex size-9 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg">
                          <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                        </span>
                        <span className="absolute bottom-2 right-2 rounded bg-slate-950/75 px-1.5 py-0.5 text-xs font-bold text-white">
                          ดูคลิป
                        </span>
                      </button>
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.75),transparent_28%),linear-gradient(135deg,#c7d2fe,#bfdbfe_45%,#fef3c7)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <label
                      className="sr-only"
                      htmlFor={`tiktokVideoUrl-${row.id}`}
                    >
                      ลิงก์วิดีโอ TikTok {index + 1}
                    </label>
                    <input
                      className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm font-bold text-[var(--site-text)] outline-none transition placeholder:text-[var(--site-muted)] focus:border-[var(--site-border)] focus:bg-[var(--site-surface-soft)] focus:px-3 focus:ring-2 focus:ring-[var(--site-primary)]/15"
                      id={`tiktokVideoUrl-${row.id}`}
                      onChange={(event) => {
                        handleVideoUpdate(index, event.target.value);
                      }}
                      placeholder={`https://www.tiktok.com/@baanpoolvilla/video/${index + 1}`}
                      value={row.url}
                    />
                    <p className="mt-1 truncate text-xs text-[var(--site-muted)]">
                      {getTikTokVideoLabel(row.url, index)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:col-start-4 2xl:col-start-auto 2xl:justify-end">
                    {videoHref ? (
                      <a
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                        href={videoHref}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                        เปิดดู
                      </a>
                    ) : null}
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
                      onClick={() => {
                        focusVideoInput(row.id);
                      }}
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                      แก้ไข
                    </button>
                    <button
                      aria-label={`ลบแถววิดีโอ TikTok ลำดับ ${index + 1}`}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-[var(--site-surface)] px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={draft.videoUrls.length === 0}
                      onClick={() => {
                        handleDeleteVideo(index);
                      }}
                      title={`ลบแถววิดีโอ TikTok ลำดับ ${index + 1}`}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      ลบ
                    </button>
                  </div>
                  <div className="flex overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] md:col-start-4 md:w-max 2xl:col-start-auto 2xl:w-auto 2xl:flex-col">
                    <button
                      aria-label={`ย้ายแถววิดีโอที่ ${index + 1} ขึ้น`}
                      className="inline-flex h-9 w-10 items-center justify-center text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === 0 || draft.videoUrls.length < 2}
                      onClick={() => {
                        handleMoveVideo(index, -1);
                      }}
                      title={`ย้ายแถววิดีโอที่ ${index + 1} ขึ้น`}
                      type="button"
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={`ย้ายแถววิดีโอที่ ${index + 1} ลง`}
                      className="inline-flex h-9 w-10 items-center justify-center border-l border-[var(--site-border)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50 lg:border-l-0 lg:border-t"
                      disabled={
                        index >= draft.videoUrls.length - 1 ||
                        draft.videoUrls.length < 2
                      }
                      onClick={() => {
                        handleMoveVideo(index, 1);
                      }}
                      title={`ย้ายแถววิดีโอที่ ${index + 1} ลง`}
                      type="button"
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36">
        <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
              <ExternalLink aria-hidden="true" className="size-4" />
            </span>
            <h2 className="text-base font-bold text-[var(--site-text)]">
              ตัวอย่างบนหน้าแรก
            </h2>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-2xl font-black text-black">♪</span>
            <p className="min-w-0 truncate text-sm font-bold text-[var(--site-text)]">
              {getTikTokHandle(draft.accountUrl)}
            </p>
          </div>
          <p className="mt-3 text-sm text-[var(--site-muted)]">
            แสดงวิดีโอ {visibleCount} รายการ
          </p>

          <div className="mt-4 min-w-0 rounded-lg bg-[var(--site-surface-soft)] px-3 py-4 flex flex-col items-center gap-4 text-center text-sm text-[var(--site-muted)]">
            <h3 className="text-center text-base font-bold text-[var(--site-text)]">TikTok</h3>
            {activePreviewPlayerHref ? (
              <div className="mx-auto mt-4 w-[min(220px,100%)] overflow-hidden rounded-md border border-[var(--site-border)] bg-slate-950">
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  className="aspect-[9/16] w-full border-0"
                  loading="eager"
                  src={activePreviewPlayerHref}
                  title="วิดีโอ TikTok ที่เลือกดู"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-8 text-center text-sm text-[var(--site-muted)]">
                {normalizedRows.length === 0
                  ? "ยังไม่ได้เพิ่มวิดีโอ TikTok"
                  : "เลือกดูคลิปจากรายการด้านซ้าย"}
              </div>
            )}
            {accountPreview ? (
              <a
                className="mx-auto mt-4 inline-flex h-10 max-w-full items-center justify-center rounded-full border border-[var(--site-primary)] bg-[var(--site-surface)] px-4 text-xs font-bold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                href={accountPreview}
                rel="noopener noreferrer"
                target="_blank"
              >
                ติดตามเราบน TikTok
              </a>
            ) : null}
          </div>
        </section>
      </aside>
    </form>
  );
}
