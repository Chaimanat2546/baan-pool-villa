import { describe, expect, it } from "vitest";
import {
  buildDefaultHomePageLayout,
  moveHomePageLayoutItem,
  parseHomePageLayout,
  validateHomePageLayout,
} from "../layout";

describe("homepage layout", () => {
  it("preserves the current public order when seeded from rails", () => {
    expect(buildDefaultHomePageLayout(["featured", "near-sea"])).toEqual([
      { kind: "rail", key: "featured", enabled: true },
      { kind: "fixed", key: "why_choose", enabled: true },
      { kind: "rail", key: "near-sea", enabled: true },
      { kind: "fixed", key: "tiktok", enabled: true },
      { kind: "fixed", key: "customer_reviews", enabled: true },
      { kind: "fixed", key: "articles", enabled: true },
      { kind: "fixed", key: "faq", enabled: true },
      { kind: "fixed", key: "contact", enabled: true },
    ]);
  });

  it("keeps built-ins when there are no rails", () => {
    expect(buildDefaultHomePageLayout([])[0]).toEqual({
      kind: "fixed",
      key: "why_choose",
      enabled: true,
    });
  });

  it("rejects a missing fixed key, duplicate rail, and stale rail", () => {
    const parsed = parseHomePageLayout([
      { kind: "fixed", key: "why_choose", enabled: true },
      { kind: "rail", key: "featured", enabled: true },
      { kind: "rail", key: "featured", enabled: true },
    ]);

    expect(parsed.errors).toEqual([]);
    expect(validateHomePageLayout(parsed.items, ["featured"])).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ส่วนของระบบไม่ครบ"),
        expect.stringContaining("featured ซ้ำ"),
      ]),
    );
  });

  it("moves one mixed item without mutating the input", () => {
    const input = buildDefaultHomePageLayout(["featured"]);
    const moved = moveHomePageLayoutItem(input, 1, 0);

    expect(moved[0]).toMatchObject({ kind: "fixed", key: "why_choose" });
    expect(input[0]).toMatchObject({ kind: "rail", key: "featured" });
  });
});
