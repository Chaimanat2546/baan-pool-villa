import { describe, expect, it, vi } from "vitest";

const executeCentralUserManagerRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/central-user-manager/rpc-service", () => ({
  executeCentralUserManagerRpc,
}));

import { POST } from "./route";

describe("Central User Manager private Worker bridge", () => {
  it("passes a JSON RPC input to the pure service and returns its structured result", async () => {
    const input = { operationId: "operation-1" };
    const result = { ok: true, operation: { status: "completed" } };
    executeCentralUserManagerRpc.mockResolvedValueOnce(result);

    const response = await POST(new Request(
      "https://worker.internal/api/_worker/central-user-manager",
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    ));

    expect(executeCentralUserManagerRpc).toHaveBeenCalledWith(input);
    expect(await response.json()).toEqual(result);
  });

  it("passes invalid JSON to the pure service as null", async () => {
    const result = {
      ok: false,
      error: {
        code: "invalid_request",
        message: "Invalid user management request.",
      },
    };
    executeCentralUserManagerRpc.mockResolvedValueOnce(result);

    const response = await POST(new Request(
      "https://worker.internal/api/_worker/central-user-manager",
      { body: "{", method: "POST" },
    ));

    expect(executeCentralUserManagerRpc).toHaveBeenCalledWith(null);
    expect(await response.json()).toEqual(result);
  });
});
