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

function renderSettingsForm() {
  return renderToStaticMarkup(
    <SettingsForm
      draft={mapSettingsToDraft(DEFAULT_SITE_SETTINGS)}
      hasUnsavedChanges={false}
      isSaving={false}
      onChange={vi.fn()}
      onSave={vi.fn()}
      settings={DEFAULT_SITE_SETTINGS}
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
});
