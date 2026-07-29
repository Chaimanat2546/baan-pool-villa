import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import {
  advanceForcedPasswordChange,
  claimForcedPasswordChangeV2,
  commitAdminUserProviderIntent,
  commitAdminUserProviderOutcome,
  completeAdminUserOperationV2,
  quarantineAdminUserOperation,
  markAdminUserOperationNeedsReview,
  recordAdminUserLateFence,
  resumeAdminUserOperation,
  renewAdminUserOperationLease,
} from "../operation-repository";

const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const ACTOR_UID = "123e4567-e89b-42d3-a456-426614174002";
const TARGET_USER_ID = "123e4567-e89b-42d3-a456-426614174003";
const REQUEST_HASH = "a".repeat(64);
const RAW_TOKEN = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
const RAW_TOKEN_HASH =
  "eb9f16800c9029ffca85695763d23c3ace71011cf40e9354acd810205e250f87";
const NEXT_RAW_TOKEN = "ISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A";
const NEXT_RAW_TOKEN_HASH =
  "22852e30bbb85708e400ba2942aa82704c519e006a7ccfe9f6547b8d136fd624";

const baseRpcOperation = {
  operation_id: OPERATION_ID,
  actor_kind: "central_admin",
  actor_uid: ACTOR_UID,
  action: "create_user",
  target_user_id: TARGET_USER_ID,
  target_email_normalized: "admin@example.com",
  request_hash: REQUEST_HASH,
  status: "leased",
  stage: "claimed",
  fence_version: 1,
  attempt_count: 1,
  lease_expires_at: "2026-07-29T01:00:30.000Z",
  safe_result: null,
  safe_error_code: null,
  safe_error_message: null,
} as const;

function deterministicCrypto(
  starts: readonly number[] = [1],
): Pick<Crypto, "getRandomValues" | "subtle"> {
  let callIndex = 0;
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array instanceof Uint8Array) {
        const start = starts[Math.min(callIndex, starts.length - 1)];
        array.set(Array.from({ length: 32 }, (_, index) => index + start));
        callIndex += 1;
      }
      return array;
    },
    subtle: globalThis.crypto.subtle,
  };
}

function fakeClient(response: {
  data: unknown;
  error: null | {
    code: string;
    message: string;
    details: string;
    hint: string;
  };
}) {
  const rpc = vi.fn().mockResolvedValue(response);
  return {
    client: { rpc } as unknown as CentralUserManagerAdminClient,
    rpc,
  };
}

describe("Central User Manager operation repository", () => {
  it("renews by proving the current token and rotating to a fresh token hash", async () => {
    const { client, rpc } = fakeClient({
      data: {
        operation: baseRpcOperation,
        disposition: "first_claim",
        lease_token_accepted: true,
      },
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: {
        operation: {
          ...baseRpcOperation,
          lease_expires_at: "2026-07-29T01:01:00.000Z",
        },
        disposition: "exact_retry",
        lease_token_accepted: true,
      },
      error: null,
    });

    const crypto = deterministicCrypto([33]);

    const result = await renewAdminUserOperationLease(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
      },
      { client, crypto },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { leaseToken: NEXT_RAW_TOKEN },
    });
    expect(result.ok && result.data.leaseToken).not.toBe(RAW_TOKEN);
    expect(rpc).toHaveBeenCalledWith("renew_admin_user_operation_lease", {
      p_operation_id: OPERATION_ID,
      p_fence_version: 1,
      p_current_lease_token_hash: RAW_TOKEN_HASH,
      p_new_lease_token_hash: NEXT_RAW_TOKEN_HASH,
      p_lease_seconds: 30,
    });
  });

  it("keeps a quarantined operation permanent and maps later claims safely", async () => {
    const quarantineClient = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "quarantined",
        stage: "quarantined",
        lease_expires_at: null,
        safe_error_code: "provider_ambiguous",
        safe_error_message: "Provider outcome is ambiguous.",
      },
      error: null,
    });

    const quarantined = await quarantineAdminUserOperation(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        errorCode: "provider_ambiguous",
      },
      { client: quarantineClient.client },
    );

    expect(quarantined).toMatchObject({
      ok: true,
      data: {
        status: "quarantined",
        safeError: {
          code: "provider_ambiguous",
          message: "Provider outcome is ambiguous.",
        },
      },
    });
    expect(quarantineClient.rpc).toHaveBeenCalledWith(
      "quarantine_admin_user_operation",
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_error_code: "provider_ambiguous",
      },
    );

    const laterClaimClient = fakeClient({
      data: null,
      error: {
        code: "P0001",
        message: "operation_quarantined",
        details: "must not escape",
        hint: "must not escape",
      },
    });
    const laterClaim = await claimForcedPasswordChangeV2(
      {
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        targetUserId: TARGET_USER_ID,
        targetEmailNormalized: "admin@example.com",
        requestHash: REQUEST_HASH,
      },
      {
        client: laterClaimClient.client,
        crypto: deterministicCrypto(),
      },
    );

    expect(laterClaim).toEqual({
      ok: false,
      error: {
        code: "operation_quarantined",
        message: "The operation is permanently quarantined.",
      },
    });
  });

  it("advances the forced-password fence without exposing the raw lease", async () => {
    const { client, rpc } = fakeClient({
      data: {
        ...baseRpcOperation,
        actor_kind: "target_admin",
        action: "complete_password_change",
        status: "completed",
        stage: "completed",
        lease_expires_at: null,
        safe_result: { credentialVersion: 2 },
      },
      error: null,
    });

    const result = await advanceForcedPasswordChange(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        stage: "completed",
        safeResult: { credentialVersion: 2 },
      },
      { client },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        action: "complete_password_change",
        status: "completed",
        safeResult: { credentialVersion: 2 },
      },
    });
    expect(rpc).toHaveBeenCalledWith("advance_forced_password_change", {
      p_operation_id: OPERATION_ID,
      p_fence_version: 1,
      p_lease_token_hash: RAW_TOKEN_HASH,
      p_stage: "completed",
      p_safe_result: { credentialVersion: 2 },
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(RAW_TOKEN);
  });

  it("resumes an expired safe-stage operation with a rotated hashed lease", async () => {
    const { client, rpc } = fakeClient({
      data: {
        operation: {
          ...baseRpcOperation,
          status: "provider_outcome",
          stage: "provider_outcome",
          fence_version: 2,
          attempt_count: 2,
        },
        disposition: "first_claim",
        lease_token_accepted: true,
      },
      error: null,
    });

    const result = await resumeAdminUserOperation(
      {
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        action: "create_user",
        targetUserId: null,
        targetEmailNormalized: "admin@example.com",
        requestHash: REQUEST_HASH,
      },
      { client, crypto: deterministicCrypto() },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        operation: { fenceVersion: 2, status: "provider_outcome" },
        leaseToken: RAW_TOKEN,
      },
    });
    expect(rpc).toHaveBeenCalledWith("resume_admin_user_operation_v2", {
      p_operation_id: OPERATION_ID,
      p_actor_uid: ACTOR_UID,
      p_action: "create_user",
      p_target_user_id: null,
      p_target_email_normalized: "admin@example.com",
      p_request_hash: REQUEST_HASH,
      p_lease_token_hash: RAW_TOKEN_HASH,
      p_lease_seconds: 30,
    });
  });

  it("maps password-free suspension checkpoints from a resumed operation", async () => {
    const { client } = fakeClient({
      data: {
        operation: {
          ...baseRpcOperation,
          action: "suspend_user",
          target_user_id: TARGET_USER_ID,
          status: "provider_outcome",
          stage: "provider_outcome",
          safe_result: {
            profileIsActive: false,
            profileForcedFlag: true,
            suspensionExpectedForcedFlag: true,
          },
        },
        disposition: "first_claim",
        lease_token_accepted: true,
      },
      error: null,
    });

    await expect(
      resumeAdminUserOperation(
        {
          operationId: OPERATION_ID,
          actorUid: ACTOR_UID,
          action: "suspend_user",
          targetUserId: TARGET_USER_ID,
          targetEmailNormalized: "admin@example.com",
          requestHash: REQUEST_HASH,
        },
        { client, crypto: deterministicCrypto() },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        operation: {
          safeResult: {
            profileIsActive: false,
            profileForcedFlag: true,
            suspensionExpectedForcedFlag: true,
          },
        },
      },
    });
  });

  it("uses scalar v2 provider intent/outcome RPCs without caller JSON", async () => {
    const intent = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "provider_intent",
        stage: "auth_update_intent",
      },
      error: null,
    });

    await expect(
      commitAdminUserProviderIntent(
        {
          operationId: OPERATION_ID,
          fenceVersion: 1,
          leaseToken: RAW_TOKEN,
          providerStep: "auth_update",
        },
        { client: intent.client },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: { stage: "auth_update_intent" },
    });
    expect(intent.rpc).toHaveBeenCalledWith(
      "commit_admin_user_provider_intent_v2",
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_provider_step: "auth_update",
      },
    );

    const outcome = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "provider_outcome",
        stage: "auth_update_succeeded",
        safe_result: {
          providerStep: "auth_update",
          outcome: "succeeded",
          userId: TARGET_USER_ID,
          credentialVersion: 2,
        },
      },
      error: null,
    });
    await commitAdminUserProviderOutcome(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        providerStep: "auth_update",
        outcome: "succeeded",
        targetUserId: TARGET_USER_ID,
        credentialVersion: 2,
        providerErrorCode: null,
      },
      { client: outcome.client },
    );
    expect(outcome.rpc).toHaveBeenCalledWith(
      "commit_admin_user_provider_outcome_v2",
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_provider_step: "auth_update",
        p_outcome: "succeeded",
        p_target_user_id: TARGET_USER_ID,
        p_credential_version: 2,
        p_provider_error_code: null,
      },
    );
  });

  it("completes through the exact scalar v2 terminal schema", async () => {
    const { client, rpc } = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "completed",
        stage: "completed",
        lease_expires_at: null,
        safe_result: {
          outcome: "success",
          user: {
            userId: TARGET_USER_ID,
            email: "admin@example.com",
            status: "password_change_required",
            createdAt: "2026-07-29T00:00:00.000Z",
            lastSignInAt: null,
            credentialVersion: 2,
            authCredentialVersion: 2,
          },
        },
      },
      error: null,
    });

    await completeAdminUserOperationV2(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        terminalKind: "success",
        user: {
          userId: TARGET_USER_ID,
          email: "admin@example.com",
          status: "password_change_required",
          createdAt: "2026-07-29T00:00:00.000Z",
          lastSignInAt: null,
          credentialVersion: 2,
          authCredentialVersion: 2,
        },
        errorCode: null,
      },
      { client },
    );

    expect(rpc).toHaveBeenCalledWith("complete_admin_user_operation_v2", {
      p_operation_id: OPERATION_ID,
      p_fence_version: 1,
      p_lease_token_hash: RAW_TOKEN_HASH,
      p_terminal_kind: "success",
      p_user_id: TARGET_USER_ID,
      p_email_normalized: "admin@example.com",
      p_user_status: "password_change_required",
      p_created_at: "2026-07-29T00:00:00.000Z",
      p_last_sign_in_at: null,
      p_credential_version: 2,
      p_auth_credential_version: 2,
      p_error_code: null,
    });
  });

  it.each([
    [
      "mark_admin_user_operation_needs_review",
      markAdminUserOperationNeedsReview,
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        errorCode: "identity_mismatch",
      },
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_error_code: "identity_mismatch",
      },
    ],
    [
      "record_admin_user_late_fence_v2",
      recordAdminUserLateFence,
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        expectedCredentialVersion: 3,
        observedCredentialVersion: 2,
      },
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_expected_credential_version: 3,
        p_observed_credential_version: 2,
      },
    ],
  ] as const)(
    "calls the safe %s terminal transition",
    async (rpcName, owner, input, expectedParams) => {
      const { client, rpc } = fakeClient({
        data: {
          ...baseRpcOperation,
          status: "needs_review",
          stage:
            rpcName === "record_admin_user_late_fence_v2"
              ? "late_fence"
              : "needs_review",
          lease_expires_at: null,
          safe_error_code:
            rpcName === "record_admin_user_late_fence_v2"
              ? "credential_version_mismatch"
              : "identity_mismatch",
          safe_error_message:
            rpcName === "record_admin_user_late_fence_v2"
              ? "Credential versions do not match."
              : "The Auth user and admin profile do not match.",
        },
        error: null,
      });

      await expect(
        owner(input as never, { client }),
      ).resolves.toMatchObject({
        ok: true,
        data: { status: "needs_review" },
      });
      expect(rpc).toHaveBeenCalledWith(rpcName, expectedParams);
    },
  );
});
