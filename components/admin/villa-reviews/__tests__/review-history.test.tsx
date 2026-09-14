// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewHistory } from "../review-history";

describe("review history", () => {
  it("shows the original snapshot followed by chronological before/after edits", () => {
    const html = renderToStaticMarkup(<ReviewHistory createdAt="2026-09-07T00:00:00Z" rating={5} comment="ล่าสุด" images={[]} logs={[
      { id: "late", reviewId: "r", createdAt: "2026-09-07T02:00:00Z", beforeSnapshot: { rating: 4, comment: "กลาง", images: [] }, afterSnapshot: { rating: 5, comment: "ล่าสุด", images: [] } },
      { id: "early", reviewId: "r", createdAt: "2026-09-07T01:00:00Z", beforeSnapshot: { rating: 3, comment: "ต้นฉบับ", images: [{ id: "one" }, { id: "two" }] }, afterSnapshot: { rating: 4, comment: "กลาง", images: [{ id: "two" }, { id: "three" }] } },
    ]} />);
    expect(html.indexOf("ต้นฉบับ")).toBeLessThan(html.indexOf("กลาง"));
    expect(html.indexOf("กลาง")).toBeLessThan(html.indexOf("ล่าสุด"));
    expect(html).toContain("3 → 4 ดาว"); expect(html).toContain("4 → 5 ดาว");
    expect(html).toContain("เพิ่ม 1 รูป"); expect(html).toContain("นำออก 1 รูป");
    expect(html).toContain("07:00"); expect(html).not.toContain("storage_path");
  });
  it("displays the original review and explicit empty edit history", () => {
    const html = renderToStaticMarkup(<ReviewHistory createdAt="2026-09-07T00:00:00Z" rating={5} comment="" images={[]} logs={[]} />);
    expect(html).toContain("ยังไม่มีการแก้ไข"); expect(html).toContain("รีวิวต้นฉบับ"); expect(html).toContain("ไม่มีข้อความ");
  });
});
