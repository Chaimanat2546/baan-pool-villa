import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ColorControl,
  SectionCard,
  TextControl,
} from "../settings-form-controls";

describe("settings form controls", () => {
  it("renders color, text, and section wrappers used by settings form", () => {
    const html = renderToStaticMarkup(
      <SectionCard
        description="Group description"
        icon={<span aria-hidden="true">I</span>}
        id="identity"
        title="Identity"
      >
        <ColorControl
          id="primaryColor"
          label="Primary color"
          onChange={vi.fn()}
          value="not-a-color"
        />
        <TextControl
          id="siteName"
          label="Site name"
          onChange={vi.fn()}
          value="Baan Pool Villa"
        />
      </SectionCard>,
    );

    expect(html).toContain('id="identity"');
    expect(html).toContain('id="primaryColor"');
    expect(html).toContain('value="#000000"');
    expect(html).toContain('id="siteName"');
    expect(html).toContain("Baan Pool Villa");
  });
});
