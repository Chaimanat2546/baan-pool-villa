import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next image config", () => {
  it("serves images directly without using the Next image optimizer", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });
});
