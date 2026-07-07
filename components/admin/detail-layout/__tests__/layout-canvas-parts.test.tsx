import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusPill } from "../layout-canvas-parts";

describe("layout canvas parts", () => {
  it("renders status labels used by the canvas", () => {
    const enabled = renderToStaticMarkup(<StatusPill enabled />);
    const disabled = renderToStaticMarkup(<StatusPill enabled={false} />);

    expect(enabled).toContain("เปิด");
    expect(disabled).toContain("ปิด");
  });
});
