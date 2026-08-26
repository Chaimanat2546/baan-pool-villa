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
import { DragEvent, FormEvent, useEffect, useState } from "react";

import { useAdminSidebarCollapsed } from "@/components/admin/layout/admin-sidebar-preference";
import { loadTikTokClientOEmbed } from "@/components/villas/home/tiktok-client-oembed";
import {
  HOMEPAGE_TIKTOK_PREVIEW_LIMIT,
  createTikTokRowId,
  isValidPreviewAccountUrl,
  makePreviewVideoRows,
} from "./tiktok-helpers";
import type {
  AdminTikTokDraft,
  AdminTikTokVideoDraft,
  TikTokVillaOption,
} from "./types";

interface TikTokFormProps {
  draft: AdminTikTokDraft;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onChange: (changes: Partial<AdminTikTokDraft>) => void;
  onSearchVillas: (query: string, signal: AbortSignal) => Promise<TikTokVillaOption[]>;
  onSave: () => void;
}

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

function TikTokVideoTitle({
  fallbackIndex,
  videoUrl,
}: {
  fallbackIndex: number;
  videoUrl: string;
}) {
  const fallbackLabel = getTikTokVideoLabel(videoUrl, fallbackIndex);
  const [title, setTitle] = useState(fallbackLabel);

  useEffect(() => {
    const trimmedVideoUrl = videoUrl.trim();
    const controller = new AbortController();

    if (!trimmedVideoUrl) {
      return () => {
        controller.abort();
      };
    }

    void loadTikTokClientOEmbed(trimmedVideoUrl, controller.signal).then((metadata) => {
      if (!controller.signal.aborted && metadata?.title) {
        setTitle(metadata.title);
      }
    });

    return () => {
      controller.abort();
    };
  }, [videoUrl]);

  return (
    <p
      className="order-3 min-w-0 basis-full line-clamp-2 text-sm font-medium text-[var(--site-muted)] lg:basis-auto lg:flex-1 lg:line-clamp-1"
      data-tiktok-video-meta="true"
      title={title}
    >
      {title}
    </p>
  );
}

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

function focusVideoInput(rowId: string) {
  document.getElementById(`tiktokVideoUrl-${rowId}`)?.focus();
}

interface TikTokVillaPickerProps {
  index: number;
  onSearchVillas: TikTokFormProps["onSearchVillas"];
  onSelect: (villa: TikTokVillaOption | null) => void;
  row: AdminTikTokVideoDraft;
}

function TikTokVillaPicker({
  index,
  onSearchVillas,
  onSelect,
  row,
}: TikTokVillaPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TikTokVillaOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setError(null);

      void onSearchVillas(trimmedQuery, controller.signal)
        .then((nextResults) => {
          if (isCurrent) {
            setResults(nextResults);
          }
        })
        .catch((caughtError: unknown) => {
          if (isCurrent && !(caughtError instanceof DOMException && caughtError.name === "AbortError")) {
            setResults([]);
            setError(
              caughtError instanceof Error && caughtError.message.length > 0
                ? caughtError.message
                : "ค้นหาบ้านพักไม่สำเร็จ",
            );
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [onSearchVillas, query]);

  const selectedLabel = row.villaTitle ?? (row.houseId ? `บ้านพัก #${row.houseId}` : null);

  function resetSearchState() {
    setResults([]);
    setError(null);
    setIsSearching(false);
  }

  function handleQueryChange(value: string) {
    if (row.houseId) {
      onSelect(null);
    }

    setQuery(value);
    resetSearchState();
  }

  return (
    <div className="min-w-0 md:col-start-4 2xl:col-start-4 2xl:col-span-2">
      <label
        className="mb-1 block text-xs font-semibold text-[var(--site-muted)]"
        htmlFor={`tiktokVillaSearch-${row.id}`}
      >
        บ้านพักที่เกี่ยวข้อง
      </label>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          className="h-9 min-w-0 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none placeholder:text-[var(--site-muted)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={`tiktokVillaSearch-${row.id}`}
          onChange={(event) => {
            handleQueryChange(event.target.value);
          }}
          placeholder="ค้นหาชื่อหรือเลขบ้าน"
          value={selectedLabel ?? query}
        />
        {row.houseId ? (
          <button
            aria-label={`ล้างบ้านพักที่เกี่ยวข้องสำหรับวิดีโอ TikTok ${index + 1}`}
            className="h-9 shrink-0 rounded-md border border-[var(--site-border)] px-2 text-xs font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
            onClick={() => {
              handleQueryChange("");
              onSelect(null);
            }}
            type="button"
          >
            ล้าง
          </button>
        ) : null}
      </div>
      {isSearching ? <p className="mt-1 text-xs text-[var(--site-muted)]">กำลังค้นหา...</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {results.length > 0 ? (
        <div className="mt-1 grid max-h-32 overflow-y-auto rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-1">
          {results.map((villa) => (
            <button
              className="min-w-0 rounded px-2 py-1.5 text-left text-xs text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
              key={villa.id}
              onClick={() => {
                handleQueryChange("");
                onSelect(villa);
              }}
              type="button"
            >
              <span className="block break-words font-semibold">{villa.title}</span>
              <span className="block text-[var(--site-muted)]">บ้าน #{villa.id}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function addTikTokVideoRow(draft: AdminTikTokDraft): AdminTikTokDraft {
  return {
    ...draft,
    videos: [
      ...draft.videos,
      { houseId: null, id: createTikTokRowId(), url: "", villaTitle: null },
    ],
  };
}

export function updateTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
  nextValue: string,
): AdminTikTokDraft {
  const nextVideos = [...draft.videos];

  if (index >= nextVideos.length) {
    nextVideos.push({ houseId: null, id: createTikTokRowId(), url: nextValue, villaTitle: null });
  } else {
    const currentVideo = nextVideos[index];
    if (currentVideo) {
      nextVideos[index] = { ...currentVideo, url: nextValue };
    }
  }

  return {
    ...draft,
    videos: nextVideos,
  };
}

export function deleteTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
): AdminTikTokDraft {
  return {
    ...draft,
    videos: draft.videos.filter((_, existingIndex) => existingIndex !== index),
  };
}

export function moveTikTokVideoRow(
  draft: AdminTikTokDraft,
  index: number,
  direction: -1 | 1,
): AdminTikTokDraft {
  const nextVideos = moveArrayItem(draft.videos, index, index + direction);

  return {
    ...draft,
    videos: nextVideos,
  };
}

export function moveTikTokVideoRowToIndex(
  draft: AdminTikTokDraft,
  sourceIndex: number,
  targetIndex: number,
): AdminTikTokDraft {
  const nextVideos = moveArrayItem(draft.videos, sourceIndex, targetIndex);

  return {
    ...draft,
    videos: nextVideos,
  };
}

export function TikTokForm({
  draft,
  hasUnsavedChanges,
  isSaving,
  onChange,
  onSearchVillas,
  onSave,
}: TikTokFormProps) {
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const [draggingVideoIndex, setDraggingVideoIndex] = useState<number | null>(null);
  const [activePreviewVideoUrl, setActivePreviewVideoUrl] = useState<string | null>(null);
  const rows = makePreviewVideoRows(draft.videos);
  const normalizedRows = draft.videos.map((video) => video.url.trim()).filter(Boolean);
  const visibleRows = rows.filter((row) => row.url.trim().length > 0);
  const visibleCount = Math.min(HOMEPAGE_TIKTOK_PREVIEW_LIMIT, visibleRows.length);
  const accountPreview = getAccountPreviewHref(draft.accountUrl);
  const activePreviewPlayerHref = getTikTokPlayerHref(activePreviewVideoUrl ?? "");

  function handleVideoUpdate(index: number, nextValue: string) {
    onChange(updateTikTokVideoRow(draft, index, nextValue));
  }

  function handleAddVideo() {
    const nextDraft = addTikTokVideoRow(draft);
    const nextRowId = nextDraft.videos.at(-1)?.id;

    onChange(nextDraft);

    if (nextRowId) {
      window.requestAnimationFrame(() => {
        focusVideoInput(nextRowId);
      });
    }
  }

  function handleDeleteVideo(index: number) {
    if (index >= draft.videos.length) {
      return;
    }

    onChange(deleteTikTokVideoRow(draft, index));
  }

  function handleMoveVideo(index: number, direction: -1 | 1) {
    const nextVideo = moveTikTokVideoRow(draft, index, direction);
    const isNoop = nextVideo.videos === draft.videos;

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
      sourceIndex >= draft.videos.length
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
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]"
          : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
      }`}
      data-unsaved={hasUnsavedChanges ? "true" : "false"}
      onSubmit={handleSubmit}
    >
      <div className="grid min-w-0 content-start gap-6">
        <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
              <CircleUserRound aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--site-text)]">บัญชี TikTok</h2>
              <p className="mt-1 break-words text-sm text-[var(--site-muted)]">
                แก้ลิงก์บัญชีได้จากช่องนี้ ปุ่มเปิดบัญชีจะใช้ลิงก์ล่าสุดในช่องเสมอ
              </p>
              <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <p className="text-sm text-[var(--site-muted)]">บัญชี TikTok</p>
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--site-text)]">
                  {getTikTokHandle(draft.accountUrl)}
                </p>
                {accountPreview ? (
                  <a
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] lg:w-auto"
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
              <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <label
                  className="text-sm text-[var(--site-muted)]"
                  htmlFor="tiktokAccountUrl"
                >
                  ลิงก์บัญชี
                </label>
                <input
                  className="h-10 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm font-medium text-[var(--site-primary)] outline-none transition placeholder:text-[var(--site-muted)] focus:border-[var(--site-border)] focus:bg-[var(--site-surface-soft)] focus:px-3 focus:ring-2 focus:ring-[var(--site-primary)]/15"
                  id="tiktokAccountUrl"
                  onChange={(event) => {
                    onChange({ accountUrl: event.target.value });
                  }}
                  placeholder="https://www.tiktok.com/@baanpoolvilla"
                  value={draft.accountUrl}
                />
                <button
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)] lg:w-auto"
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

        <section className="min-w-0 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-start gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                <Video aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--site-text)]">วิดีโอ TikTok</h2>
                <p className="mt-1 break-words text-sm text-[var(--site-muted)]">
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
              const canDrag = draft.videos.length > 1;

              return (
                <div
                  aria-grabbed={draggingVideoIndex === index}
                  className={`flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm transition ${
                    draggingVideoIndex === index
                      ? "border-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/15"
                      : ""
                  }`}
                  draggable={canDrag}
                  data-tiktok-card-header="true"
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
                    className="order-1 hidden cursor-grab text-[var(--site-muted)] active:cursor-grabbing lg:inline-flex"
                    role="button"
                    title={`ลากเพื่อเรียงลำดับวิดีโอ TikTok ${index + 1}`}
                  >
                    <GripVertical aria-hidden="true" className="size-5" />
                  </span>
                  <span className="order-2 inline-flex size-12 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-sm font-bold text-[var(--site-primary)]">
                    #{index + 1}
                  </span>
                  <div className="order-3 relative h-20 w-28 overflow-hidden rounded-md bg-[linear-gradient(135deg,#c7d2fe,#bfdbfe_45%,#fef3c7)] shadow-inner">
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
                  <TikTokVideoTitle
                    fallbackIndex={index}
                    key={`${row.id}:${row.url}`}
                    videoUrl={row.url}
                  />
                  <div className="order-7 min-w-0 basis-full border-t border-[var(--site-border)] pt-3">
                    <label
                      className="mb-1 block text-xs font-semibold text-[var(--site-muted)]"
                      htmlFor={`tiktokVideoUrl-${row.id}`}
                    >
                      ลิงก์วิดีโอ TikTok {index + 1}
                    </label>
                    <input
                      className="h-9 w-full min-w-0 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm font-medium text-[var(--site-text)] outline-none transition placeholder:text-[var(--site-muted)] focus:bg-[var(--site-surface-soft)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                      id={`tiktokVideoUrl-${row.id}`}
                      onChange={(event) => {
                        handleVideoUpdate(index, event.target.value);
                      }}
                      placeholder={`https://www.tiktok.com/@baanpoolvilla/video/${index + 1}`}
                      value={row.url}
                    />
                  </div>
                  <div className="order-8 basis-full" data-tiktok-card-fields="true"><TikTokVillaPicker
                    index={index}
                    onSearchVillas={onSearchVillas}
                    onSelect={(villa) => {
                      const nextVideos = [...draft.videos];
                      const currentVideo =
                        nextVideos[index] ??
                        { ...row, id: createTikTokRowId() };
                      nextVideos[index] = {
                        ...currentVideo,
                        houseId: villa?.id ?? null,
                        villaTitle: villa?.title ?? null,
                      };
                      onChange({ videos: nextVideos });
                    }}
                    row={row}
                  /></div>
                  <div className="order-4 flex w-full flex-wrap justify-start gap-2 lg:ml-auto lg:w-auto lg:justify-end">
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
                      disabled={draft.videos.length === 0}
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
                  <div className="order-5 flex overflow-hidden rounded-md border border-[var(--site-border)] bg-[var(--site-surface)]">
                    <button
                      aria-label={`ย้ายแถววิดีโอที่ ${index + 1} ขึ้น`}
                      className="inline-flex h-9 w-10 items-center justify-center text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === 0 || draft.videos.length < 2}
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
                      className="inline-flex h-9 w-10 items-center justify-center border-l border-[var(--site-border)] text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        index >= draft.videos.length - 1 ||
                        draft.videos.length < 2
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

      <aside className="grid min-w-0 content-start gap-4 lg:self-start lg:sticky lg:top-36">
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
