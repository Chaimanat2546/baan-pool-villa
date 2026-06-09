"use client";

import { useSyncExternalStore } from "react";

const ADMIN_SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";
const ADMIN_SIDEBAR_EVENT = "admin-sidebar-preference-change";
let adminSidebarInMemoryFallback: string | null = null;

function subscribeToAdminSidebarPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== null &&
      event.key !== ADMIN_SIDEBAR_STORAGE_KEY
    ) {
      return;
    }

    onStoreChange();
  };

  const handlePreferenceChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ADMIN_SIDEBAR_EVENT, handlePreferenceChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ADMIN_SIDEBAR_EVENT, handlePreferenceChange);
  };
}

function getAdminSidebarPreferenceSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return adminSidebarInMemoryFallback === "true";
  }
}

export function setAdminSidebarPreference(nextValue: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ADMIN_SIDEBAR_STORAGE_KEY,
      String(nextValue),
    );
  } catch {
    adminSidebarInMemoryFallback = String(nextValue);
    // Keep the shell usable even if storage access is blocked.
  }

  window.dispatchEvent(new Event(ADMIN_SIDEBAR_EVENT));
}

export function useAdminSidebarCollapsed() {
  return useSyncExternalStore(
    subscribeToAdminSidebarPreference,
    getAdminSidebarPreferenceSnapshot,
    () => false,
  );
}
