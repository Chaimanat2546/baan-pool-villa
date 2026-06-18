import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LockedShell, StatusPill } from "../layout-canvas-parts";

describe("layout canvas parts", () => {
  it("renders status and locked shell labels used by the canvas", () => {
    const enabled = renderToStaticMarkup(<StatusPill enabled />);
    const disabled = renderToStaticMarkup(<StatusPill enabled={false} />);
    const locked = renderToStaticMarkup(
      <LockedShell label="ล็อกไว้ด้านบน">
        <span>Gallery</span>
      </LockedShell>,
    );

    expect(enabled).toContain("เปิด");
    expect(disabled).toContain("ปิด");
    expect(locked).toContain("ล็อกไว้ด้านบน");
    expect(locked).toContain("ล็อก");
    expect(locked).toContain("Gallery");
  });
});
