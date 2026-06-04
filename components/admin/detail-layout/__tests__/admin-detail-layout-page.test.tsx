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

import { AdminDetailLayoutPage } from "../admin-detail-layout-page";

describe("AdminDetailLayoutPage", () => {
  it("renders the dashboard header and workspace sections", () => {
    const html = renderToStaticMarkup(<AdminDetailLayoutPage />);

    expect(html).toContain("จัดหน้า Details");
    expect(html).toContain("บันทึกล่าสุดแล้ว");
    expect(html).toContain("ค่าเริ่มต้น");
    expect(html).toContain("พรีวิวหน้าจริง");
    expect(html).toContain("บันทึกแล้ว");
  });
});
