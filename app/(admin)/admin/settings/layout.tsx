import type { ReactNode } from "react";

import { SettingsLayoutShell } from "@/components/admin/settings/settings-layout-shell";

export default function AdminSettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
}
