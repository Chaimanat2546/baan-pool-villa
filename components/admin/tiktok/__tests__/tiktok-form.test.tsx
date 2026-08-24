import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TikTokForm } from "../tiktok-form";

describe("TikTokForm", () => {
  it("renders account and video inputs and row controls", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videoRowIds: ["row-1", "row-2"],
          videoUrls: [
            "https://www.tiktok.com/@baanpoolvilla/video/1",
            "https://www.tiktok.com/@baanpoolvilla/video/2",
          ],
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("บัญชี TikTok");
    expect(html).toContain("ลิงก์บัญชี");
    expect(html).toContain("เปิด TikTok");
    expect(html).toContain("แก้บัญชี");
    expect(html).toContain("วิดีโอ TikTok");
    expect(html).toContain("วิดีโอ 2 รายการ เรียงตามลำดับที่จะแสดงบนหน้าแรก");
    expect(html).toContain("เพิ่มวิดีโอ");
    expect(html).toContain("เปิดดู");
    expect(html).toContain("แก้ไข");
    expect(html).toContain("ลบแถววิดีโอ TikTok ลำดับ 1");
    expect(html).toContain("ย้ายแถววิดีโอที่ 1 ขึ้น");
    expect(html).toContain("ย้ายแถววิดีโอที่ 1 ลง");
  });

  it("renders sortable rows with click-to-preview controls without eager-loading players", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videoRowIds: ["row-1", "row-2"],
          videoUrls: [
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002",
          ],
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("draggable=\"true\"");
    expect(html).toContain("ลากเพื่อเรียงลำดับวิดีโอ TikTok 1");
    expect(html).toContain("data-preview-video-id=\"row-1\"");
    expect(html).toContain("ดูคลิป");
    expect(html).not.toContain("https://www.tiktok.com/player/v1/");
  });

  it("renders homepage-style preview panel without eager-loading all players", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videoRowIds: [
            "row-1",
            "row-2",
            "row-3",
            "row-4",
            "row-5",
            "row-6",
            "row-7",
          ],
          videoUrls: [
            "https://www.tiktok.com/@a/video/1",
            "https://www.tiktok.com/@a/video/2",
            "https://www.tiktok.com/@a/video/3",
            "https://www.tiktok.com/@a/video/4",
            "https://www.tiktok.com/@a/video/5",
            "https://www.tiktok.com/@a/video/6",
            "https://www.tiktok.com/@a/video/7",
          ],
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("ตัวอย่างบนหน้าแรก");
    expect(html).toContain("เลือกดูคลิปจากรายการด้านซ้าย");
    expect(html).not.toContain("https://www.tiktok.com/player/v1/1?controls=1&amp;rel=0");
    expect(html).not.toContain("https://www.tiktok.com/player/v1/6?controls=1&amp;rel=0");
    expect(html).toContain("แสดงวิดีโอ 7 รายการ");
    expect(html).not.toContain("เก็บไว้ในลำดับถัดไป");
    expect(html).not.toContain("ซ่อนจากหน้าแรก");
    expect(html).not.toContain("Preview หน้าแรก");
  });

  it("does not show any enable/disable toggle control in the TikTok form", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videoRowIds: [],
          videoUrls: [],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).not.toContain("Enable");
  });

  it("can add rows in memory through exported helpers", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videoRowIds: ["row-1"],
          videoUrls: ["https://www.tiktok.com/@a/video/1"],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("ลิงก์วิดีโอ TikTok 1");
  });
});
