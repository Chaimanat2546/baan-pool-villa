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

import { AdminGuidesPage } from "../admin-guides-page";

describe("AdminGuidesPage", () => {
  it("renders the sticky dashboard shell with primary guide actions", () => {
    const html = renderToStaticMarkup(<AdminGuidesPage />);

    expect(html).toContain("คู่มือคอนเทนต์");
    expect(html).toContain("จัดการบทความไกด์");
    expect(html).toContain("เพิ่มบทความ");
    expect(html).toContain("บันทึกล่าสุดแล้ว");
  });
});
