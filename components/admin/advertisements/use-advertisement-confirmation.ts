"use client";

import { useEffect, useRef, useState } from "react";

export interface AdvertisementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function useAdvertisementConfirmation(dirty: boolean) {
  const [pending, setPending] = useState<AdvertisementConfirmation | null>(null);
  const allowDocumentUnload = useRef(false);
  const replayingAnchor = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowDocumentUnload.current) {
        allowDocumentUnload.current = false;
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor && replayingAnchor.current === anchor) return;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); }
      catch { return; }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({
        title: "ออกจากหน้านี้?",
        description: "มีการแก้ไขที่ยังไม่บันทึก หากออกจากหน้านี้ข้อมูลร่างจะหายไป",
        confirmLabel: "ออกจากหน้านี้",
        cancelLabel: "แก้ไขต่อ",
        onConfirm: () => {
          allowDocumentUnload.current = true;
          if (!anchor.isConnected || anchor.href !== url.href) {
            window.location.assign(url.href);
            return;
          }
          // Preserve the link's own navigation handlers, including closing the mobile drawer.
          replayingAnchor.current = anchor;
          try {
            const allowDefault = anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            if (!allowDefault) allowDocumentUnload.current = false;
          } finally {
            replayingAnchor.current = null;
          }
        },
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeLink, true);
    };
  }, [dirty]);

  return {
    pending,
    cancel: () => setPending(null),
    confirm: () => {
      if (!pending) return;
      setPending(null);
      pending.onConfirm();
    },
    discardBefore: (onConfirm: () => void) => {
      if (!dirty) { onConfirm(); return; }
      setPending({
        title: "ละทิ้งการแก้ไข?",
        description: "การแก้ไขที่ยังไม่บันทึกจะหายไป ต้องการดำเนินการต่อหรือไม่?",
        confirmLabel: "ละทิ้งการแก้ไข",
        cancelLabel: "แก้ไขต่อ",
        onConfirm,
      });
    },
    deleteBefore: (title: string, onConfirm: () => void) => setPending({
      title: "ลบโฆษณานี้?",
      description: `ต้องการลบโฆษณา “${title}” และรูปที่เกี่ยวข้องหรือไม่?`,
      confirmLabel: "ลบโฆษณา",
      cancelLabel: "ยกเลิก",
      destructive: true,
      onConfirm,
    }),
  };
}
