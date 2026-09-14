// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutV2Draft } from "../detail-layout-v2-helpers";
import { DetailLayoutPreview } from "../detail-layout-preview";

function parseMarkup(markup: string) {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = markup;
  return doc;
}

describe("DetailLayoutPreview", () => {
  it("omits the empty sidebar zone just like the public layout", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.narrowRows = [];
    const markup = renderToStaticMarkup(<DetailLayoutPreview layout={layout} activeSelection={null} />);
    expect(markup).not.toContain("ฝั่ง 30");
    expect(markup).toContain("ฝั่ง 70");
  });
  it("stacks consecutive two-slot rows in their saved columns including a trailing empty slot", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.wideRows = [layout.mainSplit.wideRows[0], {
      id: "next", columns: 2, enabled: true,
      blocks: [{ ...layout.mainSplit.wideRows[0].blocks[0]!, title: "ถัดไป" }, null],
    }];
    const doc = parseMarkup(renderToStaticMarkup(<DetailLayoutPreview layout={layout} activeSelection={null} />));
    const columns = doc.querySelectorAll("[data-detail-preview-column]");
    expect(columns).toHaveLength(2);
    expect(columns[0].textContent).toContain("ถัดไป");
    expect(columns[1].textContent).toContain("สิ่งอำนวยความสะดวก");
    expect(doc.body.textContent).not.toContain("ช่องว่าง");
  });
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
