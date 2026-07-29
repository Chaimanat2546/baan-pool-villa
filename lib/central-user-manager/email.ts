import { AgentContractError } from "./safe-errors";

export function normalizeAdminEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AgentContractError("Admin email is required.");
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new AgentContractError("Admin email is required.");
  }

  return normalized;
}
