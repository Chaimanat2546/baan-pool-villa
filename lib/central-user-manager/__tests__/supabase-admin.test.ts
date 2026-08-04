import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "../config";
import { createCentralUserManagerAdminClient } from "../supabase-admin";

const CONFIG = {
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  supabaseSecretKey: "sb_secret_example",
} as CentralUserManagerAgentConfig;

describe("Central User Manager privileged Supabase client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("identifies privileged requests as backend traffic", async () => {
    let observedUserAgent: string | null = null;
    const fetchStub = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        observedUserAgent = headers.get("user-agent");

        return new Response(
          JSON.stringify({
            database: true,
            adminUsersTable: true,
            operationTables: true,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchStub);

    const client = createCentralUserManagerAdminClient(CONFIG);
    await client.rpc("list_reconciled_admin_users_v1", {
      p_page: 1,
      p_page_size: 1,
    });

    expect(fetchStub).toHaveBeenCalledOnce();
    expect(observedUserAgent).toBe(
      "baan-pool-villa-central-user-manager/1.0",
    );
  });
});
