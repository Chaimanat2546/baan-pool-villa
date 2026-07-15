"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SettingsDirtyStateValue {
  isDirty: boolean;
  setIsDirty: (isDirty: boolean) => void;
  setDirtySource: (key: string, isDirty: boolean) => void;
}

const SettingsDirtyStateContext = createContext<SettingsDirtyStateValue | null>(
  null,
);

export function SettingsDirtyStateProvider({ children }: { children: ReactNode }) {
  const [dirtySources, setDirtySources] = useState<Set<string>>(() => new Set());
  const setDirtySource = useCallback((key: string, isDirty: boolean) => {
    setDirtySources((current) => {
      const next = new Set(current);
      if (isDirty) next.add(key);
      else next.delete(key);
      return next.size === current.size && [...next].every((item) => current.has(item))
        ? current
        : next;
    });
  }, []);
  const setIsDirty = useCallback(
    (isDirty: boolean) => setDirtySource("legacy", isDirty),
    [setDirtySource],
  );
  const isDirty = dirtySources.size > 0;
  const value = useMemo(
    () => ({ isDirty, setDirtySource, setIsDirty }),
    [isDirty, setDirtySource, setIsDirty],
  );

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <SettingsDirtyStateContext.Provider value={value}>
      {children}
    </SettingsDirtyStateContext.Provider>
  );
}

export function useSettingsDirtyState(): SettingsDirtyStateValue {
  const value = useContext(SettingsDirtyStateContext);

  if (!value) {
    throw new Error(
      "useSettingsDirtyState must be used within SettingsDirtyStateProvider.",
    );
  }

  return value;
}
