"use client";

import { lockAdminDialogScroll } from "@/components/admin/admin-dialog-scroll-lock";

import { useEffect, useId, useRef } from "react";
import type { AdvertisementConfirmation } from "./use-advertisement-confirmation";

export function AdvertisementConfirmationDialog({ confirmation, onCancel, onConfirm }: {
  confirmation: AdvertisementConfirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    cancelRef.current?.focus();
    const releaseScroll = lockAdminDialogScroll();
    return () => {
      dialog.close();
      releaseScroll();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onCancel(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault();
          confirmRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 text-[var(--site-text)] shadow-xl backdrop:bg-black/45">
      <h2 id={titleId} className="text-lg font-medium">{confirmation.title}</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-6 break-words text-[var(--site-muted)]">{confirmation.description}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-11 rounded-md border border-[var(--site-border-strong)] px-4 text-sm hover:bg-[var(--site-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]">{confirmation.cancelLabel}</button>
        <button ref={confirmRef} type="button" onClick={onConfirm} className={`min-h-11 rounded-md px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 ${confirmation.destructive ? "bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700" : "bg-[var(--site-primary)] text-[var(--site-on-primary)] hover:opacity-90 focus-visible:outline-[var(--site-primary)]"}`}>{confirmation.confirmLabel}</button>
      </div>
    </dialog>
  );
}
