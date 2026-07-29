import "server-only";

import {
  createManagedAuthUser,
  deleteManagedAuthUser,
  findAuthUserById,
  findAuthUsersByNormalizedEmail,
  globallySignOutAccessToken,
  transientlyVerifyPassword,
  updateManagedAuthUser,
  type AuthProviderDependencies,
  type ProviderDeadlineControls,
} from "./auth-provider";
import type { CentralUserManagerAgentConfig } from "./config";
import {
  commitAdminUserProviderIntent,
  commitAdminUserProviderOutcome,
  completeAdminUserOperationV2,
  markAdminUserOperationNeedsReview,
  quarantineAdminUserOperation,
  recordAdminUserLateFence,
  renewAdminUserOperationLease,
  resumeAdminUserOperation,
} from "./operation-repository";
import {
  createAdminProfileForOperation,
  activateAdminProfileForOperation,
  advanceAdminProfileForOperation,
  findAdminProfileByUserId,
  findAdminProfilesByNormalizedEmail,
  prepareAdminUserCreateCompensation,
} from "./profile-repository";
import { listReconciledAdminUsers } from "./reconciled-list-repository";
import {
  createCentralUserManagerAdminClient,
} from "./supabase-admin";
import { generateTemporaryPassword } from "./password";
import type { CentralUserOperationContext } from "./operation-service";

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const DEFAULT_OPERATION_LEASE_MS = 30_000;

export interface ProductionContextFactoryDependencies {
  createAdminClient?: typeof createCentralUserManagerAdminClient;
  now?: () => number;
  generatePassword?: typeof generateTemporaryPassword;
  providerTimeoutMs?: number;
}

export function createProductionCentralUserOperationContext(
  config: CentralUserManagerAgentConfig,
  requestHash: string,
  dependencies: ProductionContextFactoryDependencies = {},
): CentralUserOperationContext {
  const createAdminClient =
    dependencies.createAdminClient ?? createCentralUserManagerAdminClient;
  const now = dependencies.now ?? Date.now;
  const passwordGenerator =
    dependencies.generatePassword ?? generateTemporaryPassword;
  const providerTimeoutMs =
    dependencies.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const client = createAdminClient(config);
  const operationDependencies = { client };
  const profileDependencies = { client };
  const listDependencies = { client };

  function providerDependencies(
    deadline: ProviderDeadlineControls,
  ): AuthProviderDependencies {
    return {
      client,
      createTransientClient: () => createAdminClient(config),
      deadline,
    };
  }

  function readDeadline(): ProviderDeadlineControls {
    const currentTime = now();
    return {
      timeoutMs: providerTimeoutMs,
      leaseExpiresAt: new Date(
        currentTime + DEFAULT_OPERATION_LEASE_MS,
      ).toISOString(),
      now,
    };
  }

  return {
    requestHash,
    operations: {
      claim: (input) =>
        resumeAdminUserOperation(input, operationDependencies),
      renew: (input) =>
        renewAdminUserOperationLease(input, operationDependencies),
      commitProviderIntent: (input) =>
        commitAdminUserProviderIntent(input, operationDependencies),
      commitProviderOutcome: (input) =>
        commitAdminUserProviderOutcome(input, operationDependencies),
      complete: (input) =>
        completeAdminUserOperationV2(input, operationDependencies),
      quarantine: (input) =>
        quarantineAdminUserOperation(input, operationDependencies),
      markNeedsReview: (input) =>
        markAdminUserOperationNeedsReview(input, operationDependencies),
      recordLateFence: (input) =>
        recordAdminUserLateFence(input, operationDependencies),
    },
    profiles: {
      findByNormalizedEmail: (input) =>
        findAdminProfilesByNormalizedEmail(input, profileDependencies),
      findByUserId: (input) =>
        findAdminProfileByUserId(input, profileDependencies),
      createForOperation: (input) =>
        createAdminProfileForOperation(input, profileDependencies),
      advanceForOperation: (input) =>
        advanceAdminProfileForOperation(input, profileDependencies),
      activateForOperation: (input) =>
        activateAdminProfileForOperation(input, profileDependencies),
      prepareCompensation: (input) =>
        prepareAdminUserCreateCompensation(input, profileDependencies),
    },
    auth: {
      findByUserId: (input) =>
        findAuthUserById(input, providerDependencies(readDeadline())),
      findByNormalizedEmail: (input, deadline) =>
        findAuthUsersByNormalizedEmail(
          input,
          providerDependencies(deadline),
        ),
      createManagedUser: (input, deadline) =>
        createManagedAuthUser(input, providerDependencies(deadline)),
      updateManagedUser: (input, deadline) =>
        updateManagedAuthUser(input, providerDependencies(deadline)),
      verifyPassword: (input, deadline) =>
        transientlyVerifyPassword(input, providerDependencies(deadline)),
      globallySignOut: (input, deadline) =>
        globallySignOutAccessToken(input, providerDependencies(deadline)),
      deleteManagedUser: (input, deadline) =>
        deleteManagedAuthUser(input, providerDependencies(deadline)),
    },
    list: {
      listPage: (input) =>
        listReconciledAdminUsers(input, listDependencies),
    },
    now,
    providerTimeoutMs,
    generateTemporaryPassword: passwordGenerator,
  };
}
