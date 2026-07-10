"use client";

import { Eye, Save } from "lucide-react";

interface SettingsSectionHeaderProps {
  title: string;
  description: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
}

export function SettingsSectionHeader({
  title,
  description,
  hasUnsavedChanges,
  isSaving,
  onSave,
}: SettingsSectionHeaderProps) {
  return (
    <header className="grid gap-4 border-b border-[var(--site-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[var(--site-text)]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
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
        <button
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:opacity-70"
          disabled={isSaving || !hasUnsavedChanges}
          onClick={() => void onSave()}
          type="button"
        >
          <Save aria-hidden="true" className={isSaving ? "size-4 animate-pulse" : "size-4"} />
          {isSaving ? "กำลังบันทึก..." : "บันทึกส่วนนี้"}
        </button>
      </div>
    </header>
  );
}
