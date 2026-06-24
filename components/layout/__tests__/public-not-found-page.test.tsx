import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicNotFoundPage } from "../public-not-found-page";

describe("PublicNotFoundPage", () => {
  it("renders the supplied copy and actions", () => {
    const markup = renderToStaticMarkup(
      <PublicNotFoundPage
        title="ไม่พบหน้าที่คุณกำลังหา"
        description="ลองค้นหาหรือกลับหน้าแรก"
        actions={[
          { href: "/search", label: "ไปหน้าค้นหา", icon: "search" },
          { href: "/", label: "กลับหน้าแรก", icon: "home", variant: "secondary" },
        ]}
      />,
    );

    expect(markup).toContain("404");
    expect(markup).toContain("ไม่พบหน้าที่คุณกำลังหา");
    expect(markup).toContain("ลองค้นหาหรือกลับหน้าแรก");
    expect(markup).toContain('href="/search?guests=2&bedrooms=1&maxPrice=58900"');
    expect(markup).toContain('href="/"');
  });

  it("keeps villa copy route-specific", () => {
    const markup = renderToStaticMarkup(
      <PublicNotFoundPage
        title="ไม่พบบ้านพักนี้"
        description="ลองกลับไปค้นหาบ้านพักอื่น"
        actions={[{ href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "กลับไปค้นหาบ้านพัก", icon: "search" }]}
      />,
    );

    expect(markup).toContain("ไม่พบบ้านพักนี้");
    expect(markup).toContain("กลับไปค้นหาบ้านพัก");
    expect(markup).not.toContain("ไม่พบหน้าที่คุณกำลังหา");
  });
});
