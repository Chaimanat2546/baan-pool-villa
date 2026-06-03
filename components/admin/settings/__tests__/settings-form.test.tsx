import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) => <span aria-label={alt} data-src={src} />,
}));

vi.mock("@/lib/site-settings/colors", () => ({
  buildSiteThemeStyle: vi.fn(() => ({
    "--site-accent": "#eab308",
    "--site-primary": "#064e3b",
  })),
}));

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";

import { SettingsForm } from "../settings-form";
import { mapSettingsToDraft } from "../settings-helpers";

function renderSettingsForm(
  settings = DEFAULT_SITE_SETTINGS,
) {
  return renderToStaticMarkup(
    <SettingsForm
      draft={mapSettingsToDraft(settings)}
      onChange={vi.fn()}
      onSave={vi.fn()}
      settings={settings}
    />,
  );
}

describe("SettingsForm", () => {
  it("groups brand appearance fields in the order admins expect", () => {
    const html = renderSettingsForm();
    const expectedOrder = [
      "ตัวตนแบรนด์",
      "สีของเว็บ",
      "รูปภาพหลัก",
      "ตอนแชร์ลิงก์และ Google",
    ];

    expectedOrder.reduce((previousIndex, label) => {
      const index = html.indexOf(label);

      expect(index).toBeGreaterThan(previousIndex);

      return index;
    }, -1);
  });

  it("shows live brand, Google, and share previews beside the form", () => {
    const html = renderSettingsForm();

    expect(html).toContain("ตัวอย่างหน้าเว็บ");
    expect(html).toContain("ตัวอย่างผลค้นหา Google");
    expect(html).toContain("ตัวอย่างตอนแชร์ลิงก์");
    expect(html).toContain("ดูบ้านพัก");
  });
  it("shows TikTok controls in form and side preview", () => {
    const html = renderSettingsForm({
      ...DEFAULT_SITE_SETTINGS,
      tiktok: {
        accountUrl: "https://www.tiktok.com/@baanpoolvilla",
        videos: [
          {
            url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001",
            videoId: "7370000000000000001",
          },
          {
            url: "",
            videoId: "",
          },
          {
            url: "",
            videoId: "",
          },
        ],
      },
    });

    expect(html).toContain("TikTok");
    expect(html).toContain("ตั้งค่าแล้ว 1 วิดีโอ");
    expect(html).toContain("https://www.tiktok.com/@baanpoolvilla");
    expect(html).toContain("ลิงก์บัญชี TikTok");
    expect(html).toContain("ลิงก์วิดีโอ TikTok 1");
  });

  it("shows TikTok empty state when no configured videos", () => {
    const html = renderSettingsForm({
      ...DEFAULT_SITE_SETTINGS,
      tiktok: {
        accountUrl: "",
        videos: [],
      },
    });

    expect(html).toContain("ยังไม่แสดงวิดีโอ TikTok บนหน้าแรก");
    expect(html).toContain("ยังไม่ได้ใส่ลิงก์บัญชี");
  });
});
