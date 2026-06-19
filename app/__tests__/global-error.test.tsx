import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "../global-error";

describe("GlobalError", () => {
  it("renders the app error state without inline styles", () => {
    const markup = renderToStaticMarkup(
      <GlobalError
        error={Object.assign(new Error("failed"), { digest: "123" })}
        reset={vi.fn()}
      />,
    );

    expect(markup).toContain("โหลดหน้านี้ไม่ได้");
    expect(markup).toContain("รหัสอ้างอิง: 123");
    expect(markup).not.toMatch(/\sstyle=/);
  });
});
