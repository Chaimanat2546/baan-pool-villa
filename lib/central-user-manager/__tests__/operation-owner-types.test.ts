import { expectTypeOf, it } from "vitest";

import {
  commitAdminUserProviderOutcome,
  completeAdminUserOperationV2,
} from "../operation-repository";
import { listReconciledAdminUsers } from "../reconciled-list-repository";
import type {
  OperationListRepository,
  OperationStateRepository,
} from "../operation-service";

it("keeps service owner inputs directly assignable to repository owners", () => {
  type ServiceOutcome = Parameters<
    OperationStateRepository["commitProviderOutcome"]
  >[0];
  type RepositoryOutcome = Parameters<
    typeof commitAdminUserProviderOutcome
  >[0];
  type ServiceCompletion = Parameters<
    OperationStateRepository["complete"]
  >[0];
  type RepositoryCompletion = Parameters<
    typeof completeAdminUserOperationV2
  >[0];
  type ServiceList = Parameters<
    OperationListRepository["listPage"]
  >[0];
  type RepositoryList = Parameters<
    typeof listReconciledAdminUsers
  >[0];

  expectTypeOf<ServiceOutcome>().toEqualTypeOf<RepositoryOutcome>();
  expectTypeOf<ServiceCompletion>().toEqualTypeOf<RepositoryCompletion>();
  expectTypeOf<ServiceList>().toEqualTypeOf<RepositoryList>();
});
