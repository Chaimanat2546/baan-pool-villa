import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { formatManualIdEditorText, ManualIdsEditor } from "../manual-ids-editor";

describe("formatManualIdEditorText", () => {
  it("formats pasted house ids with commas like the placeholder", () => {
    expect(formatManualIdEditorText("105 101 111")).toBe("105,101,111");
    expect(formatManualIdEditorText("105; 101, 111")).toBe("105,101,111");
  });

  it("keeps a trailing comma while admins are still typing", () => {
    expect(formatManualIdEditorText("105,")).toBe("105,");
  });

  it("keeps check and public preview actions out of the manual selection editor", () => {
    const markup = renderToStaticMarkup(
      <ManualIdsEditor manualIdText="105,101,111" onChange={vi.fn()} />,
    );

    expect(markup).not.toContain("เช็กอีกครั้ง");
    expect(markup).not.toContain("พรีวิว");
    expect(markup).toContain("พิมพ์เลขบ้านที่อยากโชว์ เช่น 105,101,111");
  });
});
