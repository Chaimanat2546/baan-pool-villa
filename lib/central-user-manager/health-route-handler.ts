import "server-only";

import { requireCentralBearer } from "./bearer-auth";
import {
  getCentralUserManagerAgentConfig,
  type CentralUserManagerAgentConfig,
} from "./config";
import {
  getCentralUserManagerHealth,
  isCentralUserManagerHealthData,
  type CentralUserManagerHealthResult,
} from "./health-service";
import {
  agentErrorResponse,
  agentJsonResponse,
  agentMethodNotAllowedResponse,
  authorizeCentralAgentRequest,
} from "./route-response";
import { createCentralUserManagerAdminClient } from "./supabase-admin";

export interface HealthRouteDependencies {
  getConfig: () => CentralUserManagerAgentConfig;
  getHealth: (
    config: CentralUserManagerAgentConfig,
    tokenVersion: number,
  ) => Promise<CentralUserManagerHealthResult | unknown>;
  requireBearer?: typeof requireCentralBearer;
}

const PRODUCTION_DEPENDENCIES: HealthRouteDependencies = {
  getConfig: getCentralUserManagerAgentConfig,
  getHealth: async (config, tokenVersion) => {
    const client = createCentralUserManagerAdminClient(config);
    return getCentralUserManagerHealth(config, tokenVersion, client);
  },
  requireBearer: requireCentralBearer,
};

export function createHealthRouteHandlers(
  dependencies: HealthRouteDependencies = PRODUCTION_DEPENDENCIES,
) {
  return {
    async GET(request: Request): Promise<Response> {
      const authorization = await authorizeCentralAgentRequest(request, {
        getConfig: dependencies.getConfig,
        requireBearer: dependencies.requireBearer,
      });
      if (!authorization.ok) {
        return authorization.response;
      }

      let health: CentralUserManagerHealthResult | unknown;
      try {
        health = await dependencies.getHealth(
          authorization.config,
          authorization.bearer.tokenVersion,
        );
      } catch {
        return agentErrorResponse(
          503,
          "health_unavailable",
          "Central User Manager health checks failed.",
        );
      }

      if (
        typeof health !== "object" ||
        health === null ||
        !("ok" in health) ||
        health.ok !== true ||
        !("data" in health) ||
        !isCentralUserManagerHealthData(health.data)
      ) {
        return agentErrorResponse(
          503,
          "health_unavailable",
          "Central User Manager health checks failed.",
        );
      }

      return agentJsonResponse(health.data);
    },
    methodNotAllowed(): Response {
      return agentMethodNotAllowedResponse("GET");
    },
  };
}
