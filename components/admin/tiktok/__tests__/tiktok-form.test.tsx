/**
 * @vitest-environment jsdom
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mockLoadTikTokClientOEmbed = vi.hoisted(() => vi.fn());

vi.mock("@/components/villas/home/tiktok-client-oembed", () => ({
  loadTikTokClientOEmbed: mockLoadTikTokClientOEmbed,
}));

import { TikTokForm } from "../tiktok-form";

describe("TikTokForm", () => {
  it("shows the fetched TikTok title in the video card header", async () => {
    mockLoadTikTokClientOEmbed.mockResolvedValue({
      authorName: "Baan Pool Villa",
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/cover.jpg",
      title: "พูลวิลล่าพัทยา ใกล้ทะเล",
    });

    const page = await mountAdminPage(
      <TikTokForm
        draft={{
          accountUrl: "",
          videos: [
            {
              houseId: null,
              id: "row-1",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              villaTitle: null,
            },
          ],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
      />,
    );

    expect(mockLoadTikTokClientOEmbed).toHaveBeenCalledWith(
      "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
      expect.any(AbortSignal),
    );
    expect(page.container.querySelector("[data-tiktok-video-meta]")?.textContent).toBe(
      "พูลวิลล่าพัทยา ใกล้ทะเล",
    );

    await page.unmount();
  });

  it("renders account and video inputs and row controls", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videos: [
            { id: "row-1", url: "https://www.tiktok.com/@baanpoolvilla/video/1", houseId: null, villaTitle: null },
            { id: "row-2", url: "https://www.tiktok.com/@baanpoolvilla/video/2", houseId: null, villaTitle: null },
          ],
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
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
    expect(html).toContain("บ้านพักที่เกี่ยวข้อง");
    expect(html).toContain('data-tiktok-card-header="true"');
    expect(html).toContain('data-tiktok-card-fields="true"');
    expect(html).toContain('data-tiktok-video-meta="true"');
    expect(html).toMatch(
      /class="(?![^"]*border-transparent)[^"]*border-\[var\(--site-border\)\][^"]*" id="tiktokVideoUrl-row-1"/,
    );
    expect(html).toContain("min-w-0 rounded-lg border");
    expect(html).toContain("flex min-w-0 flex-wrap items-center gap-3");
    expect(html).toContain("order-3 min-w-0 basis-full line-clamp-2");
    expect(html).toContain(
      "order-4 flex w-full flex-wrap justify-start gap-2 lg:ml-auto lg:w-auto lg:justify-end",
    );
  });

  it("shows the selected villa name inside the villa input without a separate selection block", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videos: [
            {
              houseId: "501",
              id: "row-1",
              url: "https://www.tiktok.com/@baanpoolvilla/video/1",
              villaTitle: "Sea Breeze Pool Villa",
            },
          ],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
      />,
    );

    expect(html).toContain('value="Sea Breeze Pool Villa"');
    expect(html).toContain("grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2");
    expect(html).not.toContain("เลือกแล้ว:");
  });

  it("renders sortable rows with click-to-preview controls without eager-loading players", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videos: [
            { id: "row-1", url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001", houseId: null, villaTitle: null },
            { id: "row-2", url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002", houseId: null, villaTitle: null },
          ],
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
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
          videos: Array.from({ length: 7 }, (_, index) => ({
            id: `row-${index + 1}`,
            url: `https://www.tiktok.com/@a/video/${index + 1}`,
            houseId: null,
            villaTitle: null,
          })),
        }}
        hasUnsavedChanges
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
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

  it("keeps the homepage preview alongside the editor and sticky from the desktop breakpoint", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videos: [],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
      />,
    );

    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]");
    expect(html).toContain("lg:self-start lg:sticky lg:top-36");
  });

  it("does not show any enable/disable toggle control in the TikTok form", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videos: [],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
      />,
    );

    expect(html).not.toContain("Enable");
  });

  it("can add rows in memory through exported helpers", () => {
    const html = renderToStaticMarkup(
      <TikTokForm
        draft={{
          accountUrl: "",
          videos: [{ id: "row-1", url: "https://www.tiktok.com/@a/video/1", houseId: null, villaTitle: null }],
        }}
        hasUnsavedChanges={false}
        isSaving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSearchVillas={vi.fn()}
      />,
    );

    expect(html).toContain("ลิงก์วิดีโอ TikTok 1");
  });
});
