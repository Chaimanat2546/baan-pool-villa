import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
  new URL("./deploy-client.ps1", import.meta.url),
);

async function readScript() {
  return (await readFile(SCRIPT_PATH, "utf8")).replaceAll("\r\n", "\n");
}

describe("local client deployment command", () => {
  it("isolates each target's local build variables and restores the caller state", async () => {
    const source = await readScript();

    expect(source).toContain(
      '[ValidateSet("baanparty", "baan02", "baanPMhee")]',
    );
    expect(source).toContain('ChildPath ".env.$Target.local"');
    expect(source).toContain('"NEXT_PUBLIC_SITE_URL"');
    expect(source).toContain('"NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL"');
    expect(source).toContain(
      '"NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY"',
    );
    expect(source).toContain('"NEXT_PUBLIC_TURNSTILE_SITE_KEY"');
    expect(source).toContain('"SUPABASE_PUBLISHABLE_KEY"');
    expect(source).toContain("try {");
    expect(source).toContain("} finally {");
    expect(source).toContain(
      '-Arguments @("run", "validate:deploy:cf", "--", $Target)',
    );
    expect(source).toContain('-Arguments @("run", "build:cf")');
    expect(source).toContain(
      '-Arguments @("run", "deploy:cf:built", "--", "--env", $Target)',
    );
  });
});
