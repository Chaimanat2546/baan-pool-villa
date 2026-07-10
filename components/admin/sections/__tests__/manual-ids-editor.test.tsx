import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ManualIdsEditor } from "../manual-ids-editor";

describe("ManualIdsEditor", () => {
  it("keeps check and public preview actions out of the manual selection editor", () => {
    const markup = renderToStaticMarkup(
      <ManualIdsEditor
        houses={[{ id: "105", title: "บ้านริมทะเล" }]}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        selectedHouseIds={["105"]}
      />,
    );

    expect(markup).not.toContain("เช็กอีกครั้ง");
    expect(markup).not.toContain("พรีวิว");
    expect(markup).toContain("บ้านริมทะเล");
    expect(markup).toContain("105");
  });
});
