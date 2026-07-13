"use client";

import type { ReactNode } from "react";

import { SettingsDirtyStateProvider } from "./settings-dirty-state";
import { SettingsSidebar } from "./settings-sidebar";

export function SettingsLayoutShell({ children }: { children: ReactNode }) {
  return (
    <SettingsDirtyStateProvider>
      <div className="grid min-w-0 gap-5 text-[var(--site-text)] lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <SettingsSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </SettingsDirtyStateProvider>
  );
}
