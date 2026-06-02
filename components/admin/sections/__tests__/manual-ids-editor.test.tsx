import { describe, expect, it } from "vitest";

import { formatManualIdEditorText } from "../manual-ids-editor";

describe("formatManualIdEditorText", () => {
  it("formats pasted house ids with commas like the placeholder", () => {
    expect(formatManualIdEditorText("105 101 111")).toBe("105,101,111");
    expect(formatManualIdEditorText("105; 101, 111")).toBe("105,101,111");
  });

  it("keeps a trailing comma while admins are still typing", () => {
    expect(formatManualIdEditorText("105,")).toBe("105,");
  });
});
