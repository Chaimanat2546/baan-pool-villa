import { describe, expect, it } from "vitest";

import {
  formatCommaSeparatedInput,
  parseCommaSeparatedTags,
  parseRecommendedHouseIdsInput,
} from "../guide-input-helpers";

describe("guide input helpers", () => {
  it("formats array values as one comma-separated input value", () => {
    expect(
      formatCommaSeparatedInput(["ครอบครัว", "พูลวิลล่าพัทยา", "บ้านพักแนะนำ"]),
    ).toBe("ครอบครัว,พูลวิลล่าพัทยา,บ้านพักแนะนำ");
  });

  it("keeps tag phrases intact while splitting by comma", () => {
    expect(
      parseCommaSeparatedTags(
        "ครอบครัวใหญ่, พูลวิลล่าพัทยา, บ้านพักแนะนำ",
      ),
    ).toEqual(["ครอบครัวใหญ่", "พูลวิลล่าพัทยา", "บ้านพักแนะนำ"]);
  });

  it("normalizes comma-separated recommended villa IDs", () => {
    expect(parseRecommendedHouseIdsInput("DV-66,BPV-102,901")).toEqual([
      "66",
      "102",
      "901",
    ]);
  });
});
