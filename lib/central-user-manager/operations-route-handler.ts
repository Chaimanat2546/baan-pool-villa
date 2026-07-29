import "server-only";

import { requireCentralBearer } from "./bearer-auth";
import {
  getCentralUserManagerAgentConfig,
  type CentralUserManagerAgentConfig,
} from "./config";
import {
  parseAgentOperationRequest,
  type AgentOperationRequest,
  type AgentOperationResponse,
} from "./contracts";
import {
  executeCentralUserOperation,
  type CentralUserOperationContext,
} from "./operation-service";
import { createProductionCentralUserOperationContext } from "./production-context";
import {
  agentErrorResponse,
  agentMethodNotAllowedResponse,
  authorizeCentralAgentRequest,
  operationRouteResponse,
  readBoundedRequestBytes,
  sha256Hex,
} from "./route-response";

export interface OperationsRouteDependencies {
  getConfig: () => CentralUserManagerAgentConfig;
  createContext: (
    config: CentralUserManagerAgentConfig,
    requestHash: string,
  ) => CentralUserOperationContext;
  execute: (
    context: CentralUserOperationContext,
    request: AgentOperationRequest,
  ) => Promise<AgentOperationResponse>;
  requireBearer?: typeof requireCentralBearer;
  crypto?: Pick<Crypto, "subtle">;
}

const PRODUCTION_DEPENDENCIES: OperationsRouteDependencies = {
  getConfig: getCentralUserManagerAgentConfig,
  createContext: createProductionCentralUserOperationContext,
  execute: executeCentralUserOperation,
  requireBearer: requireCentralBearer,
  crypto: globalThis.crypto,
};

function invalidBodyResponse() {
  return agentErrorResponse(
    422,
    "invalid_request",
    "Invalid agent operation request.",
  );
}

export function createOperationsRouteHandlers(
  dependencies: OperationsRouteDependencies = PRODUCTION_DEPENDENCIES,
) {
  return {
    async POST(request: Request): Promise<Response> {
      const authorization = await authorizeCentralAgentRequest(request, {
        getConfig: dependencies.getConfig,
        requireBearer: dependencies.requireBearer,
      });
      if (!authorization.ok) {
        return authorization.response;
      }

      if (request.headers.get("Content-Type") !== "application/json") {
        return agentErrorResponse(
          415,
          "unsupported_content_type",
          "Content-Type must be application/json.",
        );
      }

      const body = await readBoundedRequestBytes(request);
      if (!body.ok) {
        return body.reason === "too_large"
          ? agentErrorResponse(
              413,
              "request_too_large",
              "Agent operation request is too large.",
            )
          : invalidBodyResponse();
      }

      let rawRequest: unknown;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          body.bytes,
        );
        rawRequest = JSON.parse(text) as unknown;
      } catch {
        return invalidBodyResponse();
      }

      let operationRequest: AgentOperationRequest;
      try {
        operationRequest = parseAgentOperationRequest(rawRequest);
      } catch {
        return invalidBodyResponse();
      }

      if (operationRequest.tenantId !== authorization.config.tenantId) {
        return agentErrorResponse(
          403,
          "tenant_mismatch",
          "Tenant identity does not match.",
        );
      }

      let requestHash: string;
      try {
        requestHash = await sha256Hex(
          body.bytes,
          dependencies.crypto ?? globalThis.crypto,
        );
      } catch {
        return agentErrorResponse(
          503,
          "agent_unavailable",
          "Central User Manager Agent is unavailable.",
        );
      }

      try {
        const context = dependencies.createContext(
          authorization.config,
          requestHash,
        );
        const operation = await dependencies.execute(
          context,
          operationRequest,
        );
        return operationRouteResponse(
          authorization.config.tenantId,
          operation,
        );
      } catch {
        return agentErrorResponse(
          503,
          "agent_unavailable",
          "Central User Manager Agent is unavailable.",
        );
      }
    },
    methodNotAllowed(): Response {
      return agentMethodNotAllowedResponse("POST");
    },
  };
}
