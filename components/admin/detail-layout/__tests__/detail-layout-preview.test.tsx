import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutV2Draft } from "../detail-layout-v2-helpers";
import { DetailLayoutPreview } from "../detail-layout-preview";

describe("DetailLayoutPreview", () => {
  it("renders the V2 compact public-page structure", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const firstWideRow = layout.mainSplit.wideRows[0];
    const markup = renderToStaticMarkup(
      <DetailLayoutPreview
        activeSelection={{
          zone: "wide",
          rowId: firstWideRow.id,
          blockIndex: 0,
        }}
        layout={layout}
      />,
    );

    expect(markup).toContain("ตัวอย่างย่อ");
    expect(markup).not.toContain("Gallery");
    expect(markup).not.toContain("ชื่อบ้าน / ราคา");
    expect(markup).toContain("ฝั่ง 70");
    expect(markup).toContain("ฝั่ง 30");
    expect(markup).toContain("รายละเอียดบ้านพัก");
    expect(markup).toContain("รีวิวจากผู้เข้าพัก");
    expect(markup.indexOf("รายละเอียดบ้านพัก")).toBeLessThan(markup.indexOf("รีวิวจากผู้เข้าพัก"));
    expect(markup.indexOf("รีวิวจากผู้เข้าพัก")).toBeLessThan(markup.indexOf("จอง / ติดต่อ"));
    expect(markup).not.toContain("บ้านพักแนะนำ");
  });
});
