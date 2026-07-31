import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScrollRail } from "../scroll-rail";

describe("ScrollRail", () => {
  it("places desktop controls on the left and right of the rail", () => {
    const markup = renderToStaticMarkup(
      <ScrollRail label="บ้านพัก">
        <div>Card</div>
      </ScrollRail>,
    );

    expect(markup).toContain('data-scroll-rail-controls="sides"');
    expect(markup).toContain("hidden sm:flex");
    expect(markup).not.toContain("mt-3 hidden min-h-11");
    expect(markup).toContain('aria-label="เลื่อนบ้านพักไปทางซ้าย"');
    expect(markup).toContain('aria-label="เลื่อนบ้านพักไปทางขวา"');
  });

  it("applies controlsClassName to both side controls", () => {
    const markup = renderToStaticMarkup(
      <ScrollRail label="บ้านพัก" controlsClassName="rail-control-offset">
        <div>Card</div>
      </ScrollRail>,
    );

    expect(markup.match(/rail-control-offset/g)).toHaveLength(2);
  });
});
