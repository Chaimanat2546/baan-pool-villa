import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import {
  advanceForcedPasswordChange,
  claimAdminUserOperation,
  claimForcedPasswordChange,
  commitAdminUserOperationStage,
  completeAdminUserOperation,
  quarantineAdminUserOperation,
  renewAdminUserOperationLease,
} from "../operation-repository";

const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const ACTOR_UID = "123e4567-e89b-42d3-a456-426614174002";
const TARGET_USER_ID = "123e4567-e89b-42d3-a456-426614174003";
const REQUEST_HASH = "a".repeat(64);
const RAW_TOKEN = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
const RAW_TOKEN_HASH =
  "eb9f16800c9029ffca85695763d23c3ace71011cf40e9354acd810205e250f87";

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

function deterministicCrypto(): Pick<Crypto, "getRandomValues" | "subtle"> {
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array instanceof Uint8Array) {
        array.set(Array.from({ length: 32 }, (_, index) => index + 1));
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
  it("claims with a 30-second lease and persists only a SHA-256 token hash", async () => {
    const { client, rpc } = fakeClient({
      data: {
        operation: baseRpcOperation,
        disposition: "first_claim",
        lease_token_accepted: true,
      },
      error: null,
    });

    const result = await claimAdminUserOperation(
      {
        operationId: OPERATION_ID,
        actorKind: "central_admin",
        actorUid: ACTOR_UID,
        action: "create_user",
        targetUserId: TARGET_USER_ID,
        targetEmailNormalized: "admin@example.com",
        requestHash: REQUEST_HASH,
      },
      { client, crypto: deterministicCrypto() },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        operation: {
          operationId: OPERATION_ID,
          actorKind: "central_admin",
          actorUid: ACTOR_UID,
          action: "create_user",
          targetUserId: TARGET_USER_ID,
          targetEmailNormalized: "admin@example.com",
          requestHash: REQUEST_HASH,
          status: "leased",
          stage: "claimed",
          fenceVersion: 1,
          attemptCount: 1,
          leaseExpiresAt: "2026-07-29T01:00:30.000Z",
          safeResult: null,
          safeError: null,
        },
        leaseToken: RAW_TOKEN,
        disposition: "first_claim",
      },
    });
    expect(rpc).toHaveBeenCalledWith("claim_admin_user_operation", {
      p_operation_id: OPERATION_ID,
      p_actor_kind: "central_admin",
      p_actor_uid: ACTOR_UID,
      p_action: "create_user",
      p_target_user_id: TARGET_USER_ID,
      p_target_email_normalized: "admin@example.com",
      p_request_hash: REQUEST_HASH,
      p_lease_token_hash: RAW_TOKEN_HASH,
      p_lease_seconds: 30,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(RAW_TOKEN);
  });

  it("returns an exact retry without inventing ownership of its active lease", async () => {
    const { client } = fakeClient({
      data: {
        operation: baseRpcOperation,
        disposition: "exact_retry",
        lease_token_accepted: false,
      },
      error: null,
    });

    const result = await claimAdminUserOperation(
      {
        operationId: OPERATION_ID,
        actorKind: "central_admin",
        actorUid: ACTOR_UID,
        action: "create_user",
        targetUserId: TARGET_USER_ID,
        targetEmailNormalized: "admin@example.com",
        requestHash: REQUEST_HASH,
      },
      { client, crypto: deterministicCrypto() },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { disposition: "exact_retry", leaseToken: null },
    });
  });

  it.each([
    ["operation_conflict", "Operation conflicts with an existing request."],
    ["lease_conflict", "The operation lease is owned by another request."],
  ])(
    "maps conflicting reuse or an active lease to the closed %s error",
    async (code, message) => {
      const { client } = fakeClient({
        data: null,
        error: {
          code: "P0001",
          message: code,
          details: "sensitive row and SQL details",
          hint: "sensitive operational hint",
        },
      });

      const result = await claimAdminUserOperation(
        {
          operationId: OPERATION_ID,
          actorKind: "central_admin",
          actorUid: ACTOR_UID,
          action: "create_user",
          targetEmailNormalized: "admin@example.com",
          requestHash: REQUEST_HASH,
        },
        { client, crypto: deterministicCrypto() },
      );

      expect(result).toEqual({ ok: false, error: { code, message } });
      expect(JSON.stringify(result)).not.toContain("sensitive");
      expect(JSON.stringify(result)).not.toContain("P0001");
    },
  );

  it("accepts an expired pre-intent takeover only at the higher fence returned by SQL", async () => {
    const { client } = fakeClient({
      data: {
        operation: {
          ...baseRpcOperation,
          fence_version: 2,
          attempt_count: 2,
        },
        disposition: "first_claim",
        lease_token_accepted: true,
      },
      error: null,
    });

    const result = await claimAdminUserOperation(
      {
        operationId: OPERATION_ID,
        actorKind: "central_admin",
        actorUid: ACTOR_UID,
        action: "create_user",
        targetEmailNormalized: "admin@example.com",
        requestHash: REQUEST_HASH,
      },
      { client, crypto: deterministicCrypto() },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        operation: { fenceVersion: 2, attemptCount: 2 },
        leaseToken: RAW_TOKEN,
      },
    });
  });

  it("renews by proving the current token and rotating to a fresh token hash", async () => {
    const { client, rpc } = fakeClient({
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

    const result = await renewAdminUserOperationLease(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
      },
      { client, crypto: deterministicCrypto() },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { leaseToken: RAW_TOKEN },
    });
    expect(rpc).toHaveBeenCalledWith("renew_admin_user_operation_lease", {
      p_operation_id: OPERATION_ID,
      p_fence_version: 1,
      p_current_lease_token_hash: RAW_TOKEN_HASH,
      p_new_lease_token_hash: RAW_TOKEN_HASH,
      p_lease_seconds: 30,
    });
  });

  it("maps a completed retry and omits all lease material", async () => {
    const { client, rpc } = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "completed",
        stage: "completed",
        lease_expires_at: null,
        safe_result: { userId: TARGET_USER_ID },
      },
      error: null,
    });

    const result = await completeAdminUserOperation(
      {
        operationId: OPERATION_ID,
        safeResult: { userId: TARGET_USER_ID },
      },
      { client },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { status: "completed", stage: "completed" },
    });
    expect(rpc).toHaveBeenCalledWith("complete_admin_user_operation", {
      p_operation_id: OPERATION_ID,
      p_fence_version: null,
      p_lease_token_hash: null,
      p_safe_result: { userId: TARGET_USER_ID },
    });
    expect(JSON.stringify(result)).not.toContain("lease_token");
  });

  it("commits a provider stage using only the hashed lease token", async () => {
    const { client, rpc } = fakeClient({
      data: {
        ...baseRpcOperation,
        status: "provider_intent",
        stage: "provider_intent",
      },
      error: null,
    });

    const result = await commitAdminUserOperationStage(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: RAW_TOKEN,
        stage: "provider_intent",
        targetUserId: TARGET_USER_ID,
      },
      { client },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { status: "provider_intent", stage: "provider_intent" },
    });
    expect(rpc).toHaveBeenCalledWith("commit_admin_user_operation_stage", {
      p_operation_id: OPERATION_ID,
      p_fence_version: 1,
      p_lease_token_hash: RAW_TOKEN_HASH,
      p_stage: "provider_intent",
      p_target_user_id: TARGET_USER_ID,
      p_safe_result: null,
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
    const laterClaim = await claimForcedPasswordChange(
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
});
