import {
  commitAdminUserProviderOutcome,
  completeAdminUserOperationV2,
  type OperationRepositoryDependencies,
} from "../../operation-repository";
import {
  listReconciledAdminUsers,
  type ReconciledListRepositoryDependencies,
} from "../../reconciled-list-repository";
import type {
  OperationListRepository,
  OperationStateRepository,
} from "../../operation-service";

declare const dependencies: OperationRepositoryDependencies;
declare const listDependencies: ReconciledListRepositoryDependencies;

const commitProviderOutcome: OperationStateRepository["commitProviderOutcome"] =
  (input) => commitAdminUserProviderOutcome(input, dependencies);
const complete: OperationStateRepository["complete"] = (input) =>
  completeAdminUserOperationV2(input, dependencies);
const listPage: OperationListRepository["listPage"] = (input) =>
  listReconciledAdminUsers(input, listDependencies);

void commitProviderOutcome;
void complete;
void listPage;
