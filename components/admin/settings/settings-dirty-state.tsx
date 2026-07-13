"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SettingsDirtyStateValue {
  isDirty: boolean;
  setIsDirty: (isDirty: boolean) => void;
}

const SettingsDirtyStateContext = createContext<SettingsDirtyStateValue | null>(
  null,
);

export function SettingsDirtyStateProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const value = useMemo(() => ({ isDirty, setIsDirty }), [isDirty]);

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
