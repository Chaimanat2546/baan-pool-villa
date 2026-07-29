import {
  commitAdminUserProviderOutcome,
  completeAdminUserOperationV2,
  type OperationRepositoryDependencies,
} from "../../operation-repository";
import type { OperationStateRepository } from "../../operation-service";

declare const dependencies: OperationRepositoryDependencies;

const commitProviderOutcome: OperationStateRepository["commitProviderOutcome"] =
  (input) => commitAdminUserProviderOutcome(input, dependencies);
const complete: OperationStateRepository["complete"] = (input) =>
  completeAdminUserOperationV2(input, dependencies);

void commitProviderOutcome;
void complete;
