import { AgentContractError } from "./safe-errors";

export function normalizeAdminEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AgentContractError();
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new AgentContractError();
  }

  return normalized;
}
