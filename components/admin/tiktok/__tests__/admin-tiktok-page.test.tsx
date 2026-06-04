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

import { AdminTikTokPage } from "../admin-tiktok-page";

describe("AdminTikTokPage", () => {
  it("renders the page header and save action", () => {
    const html = renderToStaticMarkup(<AdminTikTokPage />);

    expect(html).toContain("จัดการ TikTok");
    expect(html).toContain("บันทึกการตั้งค่า TikTok");
    expect(html).toContain("ดูหน้าแรก");
    expect(html).toContain("บันทึกล่าสุดแล้ว");
  });
});
