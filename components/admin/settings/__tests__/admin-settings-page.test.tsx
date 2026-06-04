import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
    },
  })),
}));

import { AdminSettingsPage } from "../admin-settings-page";

describe("AdminSettingsPage", () => {
  it("shows the modern settings header with operational actions", () => {
    const html = renderToStaticMarkup(<AdminSettingsPage />);

    expect(html).toContain("settingsPageHeader");
    expect(html).toContain("รีเฟรชข้อมูลบ้านพัก");
    expect(html).toContain("ดูหน้าเว็บจริง");
  });
});
