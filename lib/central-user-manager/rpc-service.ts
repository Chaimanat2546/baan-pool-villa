import "server-only";

import {
  getCentralUserManagerAgentConfig,
  type CentralUserManagerAgentConfig,
} from "./config";
import type { AgentOperationResponse } from "./contracts";
import {
  executeCentralUserOperation,
  type CentralUserOperationContext,
} from "./operation-service";
import { createProductionCentralUserOperationContext } from "./production-context";
import {
  hashCentralUserRpcRequest,
  parseCentralUserRpcRequest,
  type CentralUserRpcRequest,
  type CentralUserRpcResult,
} from "./rpc-contract";
import { projectSafeCentralUserOperation } from "./safe-result";

const INVALID_REQUEST: CentralUserRpcResult = {
  ok: false,
  error: {
    code: "invalid_request",
    message: "Invalid user management request.",
  },
};
const AGENT_UNAVAILABLE: CentralUserRpcResult = {
  ok: false,
  error: {
    code: "agent_unavailable",
    message: "Central User Manager Agent is unavailable.",
  },
};

export interface RpcServiceDependencies {
  getConfig: () => CentralUserManagerAgentConfig;
  hashRequest: (
    request: CentralUserRpcRequest,
  ) => Promise<string>;
  createContext: (
    config: CentralUserManagerAgentConfig,
    requestHash: string,
  ) => CentralUserOperationContext;
  execute: (
    context: CentralUserOperationContext,
    request: CentralUserRpcRequest,
  ) => Promise<AgentOperationResponse>;
}

const PRODUCTION_DEPENDENCIES: RpcServiceDependencies = {
  getConfig: getCentralUserManagerAgentConfig,
  hashRequest: hashCentralUserRpcRequest,
  createContext: createProductionCentralUserOperationContext,
  execute: executeCentralUserOperation,
};

export async function executeCentralUserManagerRpc(
  input: unknown,
  dependencies: RpcServiceDependencies = PRODUCTION_DEPENDENCIES,
): Promise<CentralUserRpcResult> {
  let request: CentralUserRpcRequest;
  try {
    request = parseCentralUserRpcRequest(input);
  } catch {
    return INVALID_REQUEST;
  }

  let config: CentralUserManagerAgentConfig;
  try {
    config = dependencies.getConfig();
  } catch {
    return AGENT_UNAVAILABLE;
  }
  if (!config.enabled || request.tenantId !== config.tenantId) {
    return INVALID_REQUEST;
  }

  try {
    const requestHash = await dependencies.hashRequest(request);
    const context = dependencies.createContext(config, requestHash);
    const operation = await dependencies.execute(context, request);
    const safe = projectSafeCentralUserOperation(config, request, operation);
    return safe ? { ok: true, operation: safe } : AGENT_UNAVAILABLE;
  } catch {
    return AGENT_UNAVAILABLE;
  }
}
