"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const ADMIN_SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";
const ADMIN_SIDEBAR_EVENT = "admin-sidebar-preference-change";
const ADMIN_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
let adminSidebarInMemoryFallback: string | null = null;

function writeAdminSidebarPreferenceCookie(nextValue: boolean) {
  document.cookie = `${ADMIN_SIDEBAR_STORAGE_KEY}=${String(nextValue)}; path=/; max-age=${ADMIN_SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
}

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

function getAdminSidebarPreferenceSnapshot(fallbackValue = false) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const storedValue = window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);

    return storedValue === null ? fallbackValue : storedValue === "true";
  } catch {
    return adminSidebarInMemoryFallback === null
      ? fallbackValue
      : adminSidebarInMemoryFallback === "true";
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

  writeAdminSidebarPreferenceCookie(nextValue);
  window.dispatchEvent(new Event(ADMIN_SIDEBAR_EVENT));
}

export function useAdminSidebarCollapsed(initialValue = false) {
  const getSnapshot = useCallback(
    () => getAdminSidebarPreferenceSnapshot(initialValue),
    [initialValue],
  );
  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const isCollapsed = useSyncExternalStore(
    subscribeToAdminSidebarPreference,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    writeAdminSidebarPreferenceCookie(isCollapsed);
  }, [isCollapsed]);

  return isCollapsed;
}
