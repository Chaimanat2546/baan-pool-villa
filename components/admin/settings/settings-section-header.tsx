"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Save } from "lucide-react";

interface SettingsSectionHeaderProps {
  title: string;
  description: string;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  onSave?: () => Promise<void>;
}

export function SettingsSectionHeader({
  title,
  description,
  hasUnsavedChanges,
  isSaving,
  onSave,
}: SettingsSectionHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const mediaQuery = window.matchMedia?.("(min-width: 1024px)");
    let observer: IntersectionObserver | null = null;

    const observeSentinel = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          setIsCompact(!entry.isIntersecting);
        },
        { rootMargin: mediaQuery?.matches ? "0px" : "-64px 0px 0px 0px" },
      );
      observer.observe(sentinel);
    };

    observeSentinel();
    mediaQuery?.addEventListener("change", observeSentinel);
    return () => {
      mediaQuery?.removeEventListener("change", observeSentinel);
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="h-px" ref={sentinelRef} />
      <header
        className="group sticky top-16 z-20 -mx-1 grid gap-4 border-b border-[var(--site-border)] px-1 pb-4 pt-1 backdrop-blur lg:top-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end bg-transparent"
        data-compact={isCompact}
        data-settings-section-header
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--site-text)]">{title}</h1>
          <p
            className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)] group-data-[compact=true]:hidden"
            data-settings-section-description
          >
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <a
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
            href="/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Eye aria-hidden="true" className="size-4" />
            ดูหน้าเว็บไซต์จริง
          </a>
          {onSave ? <button
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:opacity-70"
            disabled={isSaving || !hasUnsavedChanges}
            onClick={() => void onSave()}
            type="button"
          >
            <Save aria-hidden="true" className={isSaving ? "size-4 animate-pulse" : "size-4"} />
            {isSaving ? "กำลังบันทึก..." : "บันทึกส่วนนี้"}
          </button> : null}
        </div>
      </header>
    </>
  );
}
