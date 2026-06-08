import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production smoke runner", () => {
  it("makes desktop and mobile smoke projects visible in the main flow", async () => {
    const script = await readFile(
      path.join(process.cwd(), "tests/support/run-production-smoke.mjs"),
      "utf8",
    );

    expect(script).toContain('const smokeProjects = ["chromium", "mobile-chromium"]');
    expect(script).toContain("smokeProjects.flatMap");
  });

  it("keeps Playwright from collecting Vitest support tests", async () => {
    const config = await readFile(
      path.join(process.cwd(), "playwright.config.ts"),
      "utf8",
    );

    expect(config).toContain('testMatch: "**/*.spec.ts"');
  });
});
