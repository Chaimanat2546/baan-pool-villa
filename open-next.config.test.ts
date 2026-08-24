import { describe, expect, it } from "vitest";

import openNextConfig from "./open-next.config";

describe("OpenNext cache configuration", () => {
  it("uses dummy OpenNext cache, tag cache, and queue implementations", () => {
    expect(openNextConfig.default?.override?.incrementalCache).toBe("dummy");
    expect(openNextConfig.default?.override?.tagCache).toBe("dummy");
    expect(openNextConfig.default?.override?.queue).toBe("dummy");
  });
});
