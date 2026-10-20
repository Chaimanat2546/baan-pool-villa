"use client";

import { lockAdminDialogScroll } from "@/components/admin/admin-dialog-scroll-lock";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SiteSettings } from "@/lib/site-settings/types";
import { AdminBrand } from "./admin-brand";
import { AdminNavigation } from "./admin-navigation";

export function AdminMobileNavigation({ onClose, settings }: { onClose: () => void; settings: SiteSettings }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    closeRef.current?.focus();
    const releaseScroll = lockAdminDialogScroll();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      dialog.close();
      releaseScroll();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="เมนูหลังบ้าน"
      aria-modal="true"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[var(--site-surface)] p-0 text-[var(--site-text)] backdrop:bg-[var(--site-surface)]"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <div className="flex h-full flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 shrink-0 items-center gap-4 border-b border-[var(--site-border)] pb-4">
          <AdminBrand settings={settings} />
          <button ref={closeRef} aria-label="ปิดเมนูหลังบ้าน" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-[var(--site-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]" onClick={onClose} type="button"><X aria-hidden="true" className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4"><AdminNavigation onNavigate={onClose} /></div>
      </div>
    </dialog>
  );
}
