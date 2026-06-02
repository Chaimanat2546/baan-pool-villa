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
  it("shows an operational action for refreshing external villa data", () => {
    const html = renderToStaticMarkup(<AdminSettingsPage />);

    expect(html).toContain("รีเฟรชข้อมูลบ้านพัก");
  });
});
