import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AdminMarketingTagsPage } from "../admin-marketing-tags-page";
it("explains Search advertising without offering website tracking setup", () => {
  const html = renderToStaticMarkup(<AdminMarketingTagsPage />);
  expect(html).toContain("โฆษณา Google Search");
  expect(html).toContain("ไม่ส่ง conversion");
  expect(html).not.toContain("<input");
  expect(html).not.toContain("data-save-marketing-tags");
});
