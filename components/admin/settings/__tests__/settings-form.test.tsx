import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill,
    height,
    src,
    width,
  }: {
    alt: string;
    fill?: boolean;
    height?: number;
    src: string;
    width?: number;
  }) => (
    <span
      aria-label={alt}
      data-fill={fill ? "true" : "false"}
      data-height={height?.toString() ?? ""}
      data-src={src}
      data-width={width?.toString() ?? ""}
    />
  ),
}));

vi.mock("@/lib/site-settings/colors", () => ({
  buildSiteThemeStyle: vi.fn(() => ({
    "--site-accent": "#eab308",
    "--site-primary": "#064e3b",
  })),
}));

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";

import { mapSettingsToDraft } from "../settings-helpers";
import { SettingsForm } from "../settings-form";

function renderSettingsForm(settings = DEFAULT_SITE_SETTINGS) {
  return renderToStaticMarkup(
    <SettingsForm
      draft={mapSettingsToDraft(settings)}
      hasUnsavedChanges={false}
      isSaving={false}
      onChange={vi.fn()}
      onSave={vi.fn()}
      settings={settings}
    />,
  );
}

describe("SettingsForm", () => {
  it("renders the settings rail in the order admins expect", () => {
    const html = renderSettingsForm();
    const expectedOrder = [
      "ข้อมูลแบรนด์",
      "สีและธีม",
      "รูปหลัก",
      "SEO และการแชร์",
      "ติดต่อและชำระเงิน",
    ];

    expectedOrder.reduce((previousIndex, label) => {
      const index = html.indexOf(label);

      expect(index).toBeGreaterThan(previousIndex);

      return index;
    }, -1);
  });

  it("shows status plus live site, Google, and share previews beside the form", () => {
    const html = renderSettingsForm();

    expect(html).toContain("สถานะการตั้งค่า");
    expect(html).toContain("ตัวอย่างหน้าเว็บ");
    expect(html).toContain("ตัวอย่างผลค้นหา Google");
    expect(html).toContain("ตัวอย่างตอนแชร์ลิงก์");
    expect(html).toContain("ดูบ้านพัก");
  });

  it("does not render TikTok controls in general settings form", () => {
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

    expect(html).not.toContain('id="tiktokAccountUrl"');
    expect(html).not.toContain("ลิงก์บัญชี TikTok");
    expect(html).not.toContain("ลิงก์วิดีโอ TikTok 1");
  });

  it("renders asset preview images with fill layout inside fixed preview frames", () => {
    const html = renderSettingsForm();

    expect(html).toContain(
      `aria-label="${DEFAULT_SITE_SETTINGS.logoImage.alt}" data-fill="true" data-height=""`,
    );
    expect(html).toContain(
      `aria-label="${DEFAULT_SITE_SETTINGS.heroImage.alt}" data-fill="true" data-height=""`,
    );
  });
});
