import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "../config";
import { executeCentralUserManagerRpc } from "../rpc-service";

const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const REQUEST = {
  protocolVersion: 1,
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
  action: "list_users",
  payload: { page: 1, pageSize: 25 },
};
const CONFIG = {
  enabled: true,
  tenantId: TENANT_ID,
} as CentralUserManagerAgentConfig;
const UNAVAILABLE = {
  ok: false,
  error: {
    code: "agent_unavailable",
    message: "Central User Manager Agent is unavailable.",
  },
};
const INVALID_REQUEST = {
  ok: false,
  error: {
    code: "invalid_request",
    message: "Invalid user management request.",
  },
};

function successfulOperation() {
  return {
    operationId: OPERATION_ID,
    status: "completed" as const,
    stage: "listed",
    result: {
      users: [],
      pagination: { page: 1, pageSize: 25, hasMore: false },
    },
  };
}

describe("Central User Manager RPC execution", () => {
  it("rejects malformed input before reading configuration", async () => {
    const getConfig = vi.fn(() => {
      throw new Error("must not run");
    });

    await expect(executeCentralUserManagerRpc({}, { getConfig } as never)).resolves.toEqual(INVALID_REQUEST);
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("redacts a configuration failure as agent unavailable", async () => {
    await expect(executeCentralUserManagerRpc(REQUEST, {
      getConfig: () => {
        throw new Error("raw configuration error");
      },
      hashRequest: async () => {
        throw new Error("must not run");
      },
      createContext: () => {
        throw new Error("must not run");
      },
      execute: async () => {
        throw new Error("must not run");
      },
    } as never)).resolves.toEqual(UNAVAILABLE);
  });

  it("rejects a disabled Agent before context creation", async () => {
    const createContext = vi.fn(() => {
      throw new Error("must not run");
    });
    const execute = vi.fn(async () => {
      throw new Error("must not run");
    });

    await expect(executeCentralUserManagerRpc(REQUEST, {
      getConfig: () => ({ ...CONFIG, enabled: false }),
      createContext,
      execute,
    } as never)).resolves.toEqual(INVALID_REQUEST);
    expect(createContext).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects another Tenant before context creation", async () => {
    const createContext = vi.fn(() => {
      throw new Error("must not run");
    });
    const execute = vi.fn(async () => {
      throw new Error("must not run");
    });

    await expect(executeCentralUserManagerRpc({
      ...REQUEST,
      tenantId: "123e4567-e89b-42d3-a456-426614174099",
    }, {
      getConfig: () => CONFIG,
      createContext,
      execute,
    } as never)).resolves.toEqual(INVALID_REQUEST);
    expect(createContext).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ["hash", {
      hashRequest: async () => { throw new Error("raw hash error"); },
      createContext: () => { throw new Error("must not run"); },
      execute: async () => { throw new Error("must not run"); },
    }],
    ["context", {
      hashRequest: async () => "a".repeat(64),
      createContext: () => { throw new Error("raw context error"); },
      execute: async () => { throw new Error("must not run"); },
    }],
    ["operation", {
      hashRequest: async () => "a".repeat(64),
      createContext: () => ({}) as never,
      execute: async () => { throw new Error("raw operation error"); },
    }],
  ] as const)("redacts a %s failure", async (_source, dependencies) => {
    await expect(executeCentralUserManagerRpc(REQUEST, {
      getConfig: () => CONFIG,
      ...dependencies,
    } as never)).resolves.toEqual(UNAVAILABLE);
  });

  it("returns an exactly projected successful operation", async () => {
    await expect(executeCentralUserManagerRpc(REQUEST, {
      getConfig: () => CONFIG,
      hashRequest: async () => "a".repeat(64),
      createContext: () => ({}) as never,
      execute: async () => ({
        ...successfulOperation(),
        providerMetadata: { accessToken: "must-not-escape" },
      } as never),
    } as never)).resolves.toEqual({
      ok: true,
      operation: successfulOperation(),
    });
  });

  it("fails closed when an operation cannot be safely projected", async () => {
    await expect(executeCentralUserManagerRpc(REQUEST, {
      getConfig: () => CONFIG,
      hashRequest: async () => "a".repeat(64),
      createContext: () => ({}) as never,
      execute: async () => ({
        operationId: OPERATION_ID,
        status: "completed",
        stage: "provider secret stage",
      } as never),
    } as never)).resolves.toEqual(UNAVAILABLE);
  });
});
