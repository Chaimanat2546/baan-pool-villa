import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BlockLibrary } from "../block-library";

describe("BlockLibrary", () => {
  it("shows a short workflow and the active target before adding blocks", () => {
    const markup = renderToStaticMarkup(
      <BlockLibrary
        onAddBlock={vi.fn()}
        onDragStart={vi.fn()}
        targetLabel="ฝั่ง 70 / แถว 1 / ช่องซ้าย"
      />,
    );

    expect(markup).toContain("ลำดับการทำงาน");
    expect(markup).toContain("เลือกช่องในผัง");
    expect(markup).toContain("เพิ่มหรือวาง block");
    expect(markup).toContain("ฝั่ง 70 / แถว 1 / ช่องซ้าย");
  });
});
