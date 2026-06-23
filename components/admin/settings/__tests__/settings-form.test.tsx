/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  flushEffects,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill,
    height,
    loading,
    src,
    width,
  }: {
    alt: string;
    fill?: boolean;
    height?: number;
    loading?: string;
    src: string;
    width?: number;
  }) => (
    <span
      aria-label={alt}
      data-fill={fill ? "true" : "false"}
      data-height={height?.toString() ?? ""}
      data-loading={loading ?? ""}
      data-src={src}
      data-width={width?.toString() ?? ""}
    />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/site-settings/colors", () => ({
  buildSiteThemeStylesheetHref: vi.fn(
    () => "/api/site-theme.css?primary=%23064e3b&accent=%23eab308&scope=settings-preview-theme",
  ),
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
      "เปลี่ยนรหัสผ่าน",
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
    expect(html).toContain('rel="stylesheet"');
    expect(html).not.toContain("style=");
  });

  it("marks visible site preview images as eager when they can be LCP", () => {
    const html = renderSettingsForm({
      ...DEFAULT_SITE_SETTINGS,
      heroImage: {
        alt: "Preview hero",
        path: "/images/BPV-66_Cover-Web.jpg",
        url: "/images/BPV-66_Cover-Web.jpg",
      },
      seo: {
        ...DEFAULT_SITE_SETTINGS.seo,
        ogImage: {
          alt: "Preview share",
          path: "/images/BPV-66_Cover-Web.jpg",
          url: "/images/BPV-66_Cover-Web.jpg",
        },
      },
    });
    const previewMarkup = html.slice(html.indexOf("settings-preview-theme"));
    const previewImages =
      previewMarkup.match(/<span\b[^>]*data-src="\/images\/BPV-66_Cover-Web\.jpg"[^>]*>/g) ??
      [];

    expect(previewImages).toHaveLength(2);
    for (const image of previewImages) {
      expect(image).toContain('data-loading="eager"');
    }
  });

  it("renders per-page SEO keyword editors", () => {
    const html = renderSettingsForm();

    expect(html).toContain('id="seoKeywords"');
    expect(html).toContain('id="searchSeoKeywords"');
    expect(html).toContain('id="guidesSeoKeywords"');
    expect(html).toContain('id="villaDetailSeoKeywords"');
  });

  it("uses upload controls for SEO share images instead of editable URL fields", () => {
    const html = renderSettingsForm();

    expect(html).toContain('id="seoOgImageFile"');
    expect(html).toContain('id="searchSeoOgImageFile"');
    expect(html).toContain('id="guidesSeoOgImageFile"');
    expect(html).not.toContain('id="seoOgImageUrl"');
    expect(html).not.toContain('id="searchSeoOgImageUrl"');
    expect(html).not.toContain('id="guidesSeoOgImageUrl"');
  });

  it("renders the account security password action", () => {
    const html = renderSettingsForm();

    expect(html).toContain("เปลี่ยนรหัสผ่าน");
    expect(html).toContain("เปลี่ยนรหัสผ่าน");
  });

  it("parses comma-separated multi-value SEO fields", async () => {
    const onChange = vi.fn();
    const page = await mountAdminPage(
      <SettingsForm
        draft={mapSettingsToDraft(DEFAULT_SITE_SETTINGS)}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={onChange}
        onSave={vi.fn()}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    const textarea = page.container.querySelector(
      "#seoKeywords",
    ) as HTMLTextAreaElement | null;

    expect(textarea).not.toBeNull();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;

      valueSetter?.call(textarea, "alpha,beta\n gamma ");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      textarea?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(onChange).toHaveBeenCalledWith({
      seoKeywords: ["alpha", "beta", "gamma"],
    });

    await page.unmount();
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
      `aria-label="${DEFAULT_SITE_SETTINGS.logoImage.alt}"`,
    );
    expect(html).toContain(
      `aria-label="${DEFAULT_SITE_SETTINGS.heroImage.alt}"`,
    );
    expect(html).toContain('data-fill="true"');
  });

  it("rejects unsupported logo files immediately", async () => {
    const onChange = vi.fn();
    const page = await mountAdminPage(
      <SettingsForm
        draft={mapSettingsToDraft(DEFAULT_SITE_SETTINGS)}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={onChange}
        onSave={vi.fn()}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    const input = page.container.querySelector(
      "#logoFile",
    ) as HTMLInputElement | null;

    expect(input).not.toBeNull();

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["logo"], "logo.gif", { type: "image/gif" })],
    });

    act(() => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(onChange).toHaveBeenCalledWith({ logoFile: null });
    expect(page.container.textContent).toContain(
      "ไฟล์โลโก้ต้องเป็น JPG, PNG หรือ WebP",
    );

    await page.unmount();
  });

  it("rejects oversized hero files immediately", async () => {
    const onChange = vi.fn();
    const page = await mountAdminPage(
      <SettingsForm
        draft={mapSettingsToDraft(DEFAULT_SITE_SETTINGS)}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={onChange}
        onSave={vi.fn()}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    const input = page.container.querySelector(
      "#heroFile",
    ) as HTMLInputElement | null;

    expect(input).not.toBeNull();

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [
        new File(["x".repeat(7 * 1024 * 1024)], "hero.webp", {
          type: "image/webp",
        }),
      ],
    });

    act(() => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(onChange).toHaveBeenCalledWith({ heroFile: null });
    expect(page.container.textContent).toContain(
      "ไฟล์Heroต้องมีขนาดไม่เกิน 6MB",
    );

    await page.unmount();
  });
});
