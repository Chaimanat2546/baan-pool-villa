import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  buildBackfillPreflight,
  deriveProjectRef,
  enumerateAuthUsers,
  enumerateProfiles,
  parseBackfillArgs,
  resolveBackfillConfig,
  runAdminAuthMetadataBackfill,
} from "../scripts/central-user-manager/backfill-lib.mjs";
import { runBackfillCli } from "../scripts/central-user-manager/backfill-admin-auth-metadata.mjs";

const PROJECT_REF = "abcdefghijklmnopqrst";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-4333-8333-333333333333";

function profile(userId = USER_A, email = " Admin@Example.com ") {
  return {
    user_id: userId,
    email,
    is_active: true,
    credential_version: 1,
  };
}

function authUser(
  id = USER_A,
  email = "admin@example.com",
  appMetadata: Record<string, unknown> = {},
) {
  return {
    id,
    email,
    app_metadata: appMetadata,
    user_metadata: {},
    aud: "authenticated",
    role: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function preflight(
  profiles: unknown[],
  users: unknown[],
) {
  return buildBackfillPreflight(profiles, users, {
    hashUid: (uid: string) =>
      createHash("sha256").update(uid).digest("hex").slice(0, 12),
  });
}

function issueCategories(result: ReturnType<typeof preflight>) {
  return result.issues.map((issue) => issue.category);
}

function createClientFixture({
  profiles = [profile()],
  profilePages,
  authPages = [[authUser()], []],
  updateErrorAt,
}: {
  profiles?: unknown[];
  profilePages?: unknown[][];
  authPages?: unknown[][];
  updateErrorAt?: number;
} = {}) {
  const range = vi.fn(
    async (
      from: number,
      to: number,
    ): Promise<{ data: unknown[]; error: Error | null }> => {
      const pageSize = to - from + 1;
      const page = Math.floor(from / pageSize);
      return {
        data: profilePages?.[page] ?? (page === 0 ? profiles : []),
        error: null,
      };
    },
  );
  const order = vi.fn((column: string, options: { ascending: boolean }) => {
    expect(column).toBe("user_id");
    expect(options).toEqual({ ascending: true });
    return { range };
  });
  const select = vi.fn((projection: string) => {
    expect(projection).toBe(
      "user_id,email,is_active,credential_version",
    );
    return { order };
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe("admin_users");
    return { select };
  });
  const listUsers = vi.fn(
    async ({
      page,
    }: {
      page: number;
      perPage: number;
    }): Promise<{ data: { users: unknown[] }; error: Error | null }> => ({
      data: { users: authPages[page - 1] ?? [] },
      error: null,
    }),
  );
  const updateUserById = vi.fn(
    async () => {
      const callNumber = updateUserById.mock.calls.length;
      return callNumber === updateErrorAt
        ? {
            data: { user: null },
            error: new Error(
              "raw secret provider failure admin@example.com sb_secret_example access-token refresh-token bearer-token",
            ),
          }
        : { data: { user: authUser() }, error: null };
    },
  );

  return {
    client: {
      from,
      auth: { admin: { listUsers, updateUserById } },
    },
    from,
    listUsers,
    order,
    range,
    select,
    updateUserById,
  };
}

describe("Central User Manager Auth metadata backfill preflight", () => {
  it.each([
    [
      "duplicate_profile_email",
      [profile(USER_A, "Admin@Example.com"), profile(USER_B, " admin@example.com ")],
      [authUser(USER_A), authUser(USER_B, "other@example.com")],
    ],
    [
      "duplicate_auth_email",
      [profile(USER_A), profile(USER_B, "other@example.com")],
      [authUser(USER_A, "Admin@Example.com"), authUser(USER_B, " admin@example.com ")],
    ],
    [
      "duplicate_profile_uid",
      [profile(USER_A), profile(USER_A, "other@example.com")],
      [authUser(USER_A)],
    ],
    [
      "duplicate_auth_uid",
      [profile(USER_A)],
      [authUser(USER_A), authUser(USER_A, "other@example.com")],
    ],
  ])("blocks %s before producing updates", (category, profiles, users) => {
    const result = preflight(profiles, users);

    expect(issueCategories(result)).toContain(category);
    expect(result.matches).toEqual([]);
  });

  it("still detects duplicate Auth identity when one row has malformed metadata", () => {
    const result = preflight(
      [profile()],
      [
        authUser(),
        authUser(USER_A, "other@example.com", {
          bpv_admin_managed: "not-a-boolean",
        }),
      ],
    );

    expect(issueCategories(result)).toContain("duplicate_auth_uid");
    expect(issueCategories(result)).toContain("malformed_auth_metadata");
  });

  it("still detects duplicate profile identity when one row is otherwise malformed", () => {
    const result = preflight(
      [
        profile(),
        { user_id: USER_A, email: "not-an-email" },
      ],
      [authUser()],
    );

    expect(issueCategories(result)).toContain("duplicate_profile_uid");
    expect(issueCategories(result)).toContain("malformed_profile");
  });

  it.each([
    ["profile_only", [profile()], []],
    ["auth_only", [], [authUser()]],
    [
      "uid_email_mismatch",
      [profile(USER_A, "admin@example.com")],
      [authUser(USER_A, "other@example.com")],
    ],
    [
      "email_uid_mismatch",
      [profile(USER_A, "admin@example.com")],
      [authUser(USER_B, "admin@example.com")],
    ],
  ])("blocks a %s identity mismatch", (category, profiles, users) => {
    expect(issueCategories(preflight(profiles, users))).toContain(category);
  });

  it.each([
    ["malformed_profile", [{ user_id: "not-a-uuid", email: "admin@example.com" }], [authUser()]],
    ["malformed_auth_user", [profile()], [{ id: USER_A, email: null, app_metadata: {} }]],
    [
      "malformed_auth_metadata",
      [profile()],
      [authUser(USER_A, "admin@example.com", { bpv_admin_managed: "yes" })],
    ],
    [
      "malformed_auth_metadata",
      [profile()],
      [
        authUser(USER_A, "admin@example.com", {
          bpv_created_operation_id: "not-an-operation-id",
        }),
      ],
    ],
    [
      "unsafe_credential_version",
      [profile()],
      [authUser(USER_A, "admin@example.com", { credential_version: 2 })],
    ],
  ])("blocks %s", (category, profiles, users) => {
    expect(issueCategories(preflight(profiles, users))).toContain(category);
  });

  it.each([
    [
      "database_credential_version_mismatch",
      {
        ...profile(USER_A, "admin@example.com"),
        credential_version: undefined,
      },
    ],
    [
      "database_credential_version_mismatch",
      { ...profile(USER_A, "admin@example.com"), credential_version: 2 },
    ],
    [
      "database_credential_version_mismatch",
      { ...profile(USER_A, "admin@example.com"), credential_version: "1" },
    ],
    [
      "database_credential_version_mismatch",
      { ...profile(USER_A, "admin@example.com"), credential_version: 0 },
    ],
    [
      "database_credential_version_mismatch",
      { ...profile(USER_A, "admin@example.com"), credential_version: 1.5 },
    ],
    [
      "database_credential_version_mismatch",
      {
        ...profile(USER_A, "admin@example.com"),
        credential_version: Number.MAX_SAFE_INTEGER + 1,
      },
    ],
    [
      "malformed_profile",
      { ...profile(USER_A, "admin@example.com"), is_active: "true" },
    ],
  ])("blocks invalid database fence state as %s", (category, row) => {
    const result = preflight(
      [row],
      [authUser(USER_A, "admin@example.com")],
    );

    expect(issueCategories(result)).toContain(category);
    expect(result.matches).toEqual([]);
  });

  it("blocks database version 2 for inactive profiles before planning an Auth downgrade", () => {
    const result = preflight(
      [
        {
          ...profile(USER_A, "admin@example.com"),
          is_active: false,
          credential_version: 2,
        },
      ],
      [authUser(USER_A, "admin@example.com")],
    );

    expect(issueCategories(result)).toContain(
      "database_credential_version_mismatch",
    );
    expect(result.matches).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null])(
    "blocks unsafe existing credential version %s",
    (credentialVersion) => {
      const result = preflight(
        [profile()],
        [authUser(USER_A, "admin@example.com", { credential_version: credentialVersion })],
      );

      expect(issueCategories(result)).toContain("unsafe_credential_version");
    },
  );

  it("preserves unrelated metadata and immutable provenance while adding owned keys", () => {
    const result = preflight(
      [profile()],
      [
        authUser(USER_A, "admin@example.com", {
          plan: "legacy",
          nested: { retained: true },
          bpv_created_operation_id: USER_C,
        }),
      ],
    );

    expect(result.issues).toEqual([]);
    expect(result.matches).toEqual([
      {
        userId: USER_A,
        needsUpdate: true,
        nextAppMetadata: {
          plan: "legacy",
          nested: { retained: true },
          bpv_created_operation_id: USER_C,
          credential_version: 1,
          bpv_admin_managed: true,
        },
      },
    ]);
  });

  it("is idempotent for an already exact Auth record", () => {
    const metadata = {
      credential_version: 1,
      bpv_admin_managed: true,
      bpv_created_operation_id: USER_C,
      retained: "value",
    };
    const result = preflight(
      [profile()],
      [authUser(USER_A, "admin@example.com", metadata)],
    );

    expect(result.issues).toEqual([]);
    expect(result.matches).toEqual([
      {
        userId: USER_A,
        needsUpdate: false,
        nextAppMetadata: metadata,
      },
    ]);
  });
});

describe("Central User Manager backfill CLI contract", () => {
  it("defaults to dry-run and requires the exact apply confirmation pair", () => {
    expect(parseBackfillArgs([])).toEqual({ mode: "dry-run" });
    expect(
      parseBackfillArgs(["--apply", "--project-ref", PROJECT_REF]),
    ).toEqual({ mode: "apply", projectRef: PROJECT_REF });

    for (const argv of [
      ["--apply"],
      ["--project-ref", PROJECT_REF],
      ["--apply", "--apply", "--project-ref", PROJECT_REF],
      ["--apply", "--project-ref", PROJECT_REF, "--project-ref", PROJECT_REF],
      ["--apply", `--project-ref=${PROJECT_REF}`],
      ["--apply", "--project-ref", "ABCDEFGHIJKLMNOPQRST"],
      ["--unknown"],
    ]) {
      expect(() => parseBackfillArgs(argv)).toThrow("Invalid backfill arguments.");
    }
  });

  it("derives and confirms the exact canonical project ref from a server-only URL", () => {
    expect(deriveProjectRef(SUPABASE_URL)).toBe(PROJECT_REF);
    expect(
      resolveBackfillConfig({
        argv: ["--apply", "--project-ref", PROJECT_REF],
        env: {
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SECRET_KEY: "sb_secret_example",
        },
      }),
    ).toEqual({
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      supabaseSecretKey: "sb_secret_example",
    });

    expect(() =>
      resolveBackfillConfig({
        argv: ["--apply", "--project-ref", "zyxwvutsrqponmlkjihg"],
        env: {
          SUPABASE_SECRET_KEY: "sb_secret_example",
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: SUPABASE_URL,
        },
      }),
    ).toThrow("Backfill configuration is invalid.");
  });

  it("creates a non-persistent secret client and emits only the JSON-safe report", async () => {
    const fixture = createClientFixture();
    const createClient = vi.fn(() => fixture.client);
    const write = vi.fn();

    const exitCode = await runBackfillCli({
      argv: [],
      env: {
        NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: SUPABASE_URL,
        SUPABASE_SECRET_KEY: "sb_secret_example",
      },
      createClient,
      write,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });

    expect(exitCode).toBe(0);
    expect(createClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      "sb_secret_example",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const output = write.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toMatchObject({
      projectRef: PROJECT_REF,
      mode: "dry-run",
    });
    expect(output).not.toContain("sb_secret_example");
    expect(output).not.toContain("admin@example.com");
  });

  it("emits a stable redacted report when provider enumeration fails", async () => {
    const fixture = createClientFixture();
    fixture.listUsers.mockResolvedValue({
      data: { users: [] },
      error: new Error(
        "raw provider error admin@example.com sb_secret_example access-token",
      ),
    });
    const write = vi.fn();

    await expect(
      runBackfillCli({
        argv: [],
        env: {
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SECRET_KEY: "sb_secret_example",
        },
        createClient: () => fixture.client,
        write,
        clock: () => new Date("2026-07-30T01:02:03.000Z"),
      }),
    ).resolves.toBe(1);

    const output = write.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toMatchObject({
      projectRef: PROJECT_REF,
      mode: "dry-run",
      categories: { execution_failed: 1 },
      completedAt: "2026-07-30T01:02:03.000Z",
    });
    for (const forbidden of [
      "raw provider error",
      "admin@example.com",
      "sb_secret_example",
      "access-token",
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });
});

describe("Central User Manager backfill execution", () => {
  it("enumerates profiles with stable bounded pagination and accepts an exact boundary", async () => {
    const fixture = createClientFixture({
      profilePages: [
        [profile(USER_A)],
        [profile(USER_B, "second@example.com")],
        [],
      ],
    });

    await expect(
      enumerateProfiles(fixture.client, { pageSize: 1, maxPages: 2 }),
    ).resolves.toHaveLength(2);
    expect(fixture.range.mock.calls).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(fixture.order).toHaveBeenCalledTimes(3);
  });

  it("fails closed when profile pagination exceeds the hard row cap", async () => {
    const fixture = createClientFixture({
      profilePages: [
        [profile(USER_A)],
        [profile(USER_B, "second@example.com")],
      ],
    });

    await expect(
      enumerateProfiles(fixture.client, { pageSize: 1, maxPages: 1 }),
    ).rejects.toThrow("Admin profile pagination limit exceeded.");
  });

  it("fails closed when any profile page returns an error", async () => {
    const fixture = createClientFixture();
    fixture.range.mockResolvedValueOnce({
      data: [],
      error: new Error("raw profile error"),
    });

    await expect(enumerateProfiles(fixture.client)).rejects.toThrow(
      "Admin profile enumeration failed.",
    );
  });

  it("finds a profile-only row beyond the first page before any Auth write", async () => {
    const fixture = createClientFixture({
      profilePages: [
        [profile(USER_A)],
        [profile(USER_B, "second@example.com")],
        [],
      ],
      authPages: [[authUser(USER_A)], []],
    });

    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      profilePageSize: 1,
      profileMaxPages: 2,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.report.categories.profile_only).toBe(1);
    expect(fixture.updateUserById).not.toHaveBeenCalled();
  });

  it("enumerates Auth users with explicit bounded pagination", async () => {
    const fixture = createClientFixture({
      authPages: [[authUser(USER_A)], [authUser(USER_B)], []],
    });

    await expect(
      enumerateAuthUsers(fixture.client, { perPage: 1, maxPages: 3 }),
    ).resolves.toHaveLength(2);
    expect(fixture.listUsers.mock.calls).toEqual([
      [{ page: 1, perPage: 1 }],
      [{ page: 2, perPage: 1 }],
      [{ page: 3, perPage: 1 }],
    ]);

    const capped = createClientFixture({
      authPages: [[authUser(USER_A)], [authUser(USER_B)]],
    });
    await expect(
      enumerateAuthUsers(capped.client, { perPage: 1, maxPages: 2 }),
    ).rejects.toThrow("Auth pagination limit exceeded.");
  });

  it("finishes the complete preflight before the first write", async () => {
    const fixture = createClientFixture({
      profiles: [profile(USER_A), profile(USER_B, "second@example.com")],
      authPages: [[authUser(USER_A)], []],
    });

    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
      authPageSize: 1,
    });

    expect(outcome.ok).toBe(false);
    expect(fixture.updateUserById).not.toHaveBeenCalled();
    expect(outcome.report.categories.profile_only).toBe(1);
  });

  it("keeps dry-run write-free and reports only redacted safe fields", async () => {
    const fixture = createClientFixture();
    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "dry-run",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });
    const serialized = JSON.stringify(outcome.report);

    expect(outcome.ok).toBe(true);
    expect(fixture.updateUserById).not.toHaveBeenCalled();
    expect(outcome.report).toMatchObject({
      projectRef: PROJECT_REF,
      mode: "dry-run",
      counts: { matched: 1, updatesPlanned: 1, updated: 0 },
      completedAt: "2026-07-30T01:02:03.000Z",
    });
    for (const forbidden of [
      "admin@example.com",
      "sb_secret_example",
      "access-token",
      "refresh-token",
      "bearer-token",
      "raw secret provider failure",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("applies preserved metadata, re-enumerates, and verifies exact state", async () => {
    const exact = authUser(USER_A, "admin@example.com", {
      retained: "yes",
      credential_version: 1,
      bpv_admin_managed: true,
    });
    const fixture = createClientFixture({
      authPages: [[authUser(USER_A, "admin@example.com", { retained: "yes" })], [], [exact], []],
    });
    fixture.listUsers.mockImplementation(async ({ page }) => {
      const call = fixture.listUsers.mock.calls.length;
      if (call <= 2) {
        return {
          data: {
            users:
              page === 1
                ? [authUser(USER_A, "admin@example.com", { retained: "yes" })]
                : [],
          },
          error: null,
        };
      }
      return { data: { users: page === 1 ? [exact] : [] }, error: null };
    });

    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
      authPageSize: 1,
    });

    expect(outcome.ok).toBe(true);
    expect(fixture.updateUserById).toHaveBeenCalledWith(USER_A, {
      app_metadata: {
        retained: "yes",
        credential_version: 1,
        bpv_admin_managed: true,
      },
    });
    expect(fixture.listUsers).toHaveBeenCalledTimes(4);
    expect(fixture.select).toHaveBeenCalledTimes(2);
    expect(outcome.report.counts).toMatchObject({ updated: 1, verified: 1 });
  });

  it("stops after a partial update failure and reports no raw provider details", async () => {
    const fixture = createClientFixture({
      profiles: [profile(USER_A), profile(USER_B, "second@example.com")],
      authPages: [
        [
          authUser(USER_A),
          authUser(USER_B, "second@example.com"),
        ],
        [],
      ],
      updateErrorAt: 2,
    });
    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });
    const serialized = JSON.stringify(outcome.report);

    expect(outcome.ok).toBe(false);
    expect(fixture.updateUserById).toHaveBeenCalledTimes(2);
    expect(outcome.report.counts.updated).toBe(1);
    expect(outcome.report.categories.auth_update_failed).toBe(1);
    for (const forbidden of [
      "raw secret provider failure",
      "admin@example.com",
      "sb_secret_example",
      "access-token",
      "refresh-token",
      "bearer-token",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain(USER_B);
    expect(outcome.report.references[0].uidRef).toMatch(/^[0-9a-f]{12}$/);
  });

  it("fails apply when post-write re-verification is not exact", async () => {
    const fixture = createClientFixture({
      authPages: [[authUser()], [], [authUser()], []],
    });
    fixture.listUsers.mockImplementation(async ({ page }) => ({
      data: { users: page === 1 ? [authUser()] : [] },
      error: null,
    }));
    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.report.categories.verification_mismatch).toBe(1);
  });

  it("fails post-apply verification when the database credential version drifts", async () => {
    const fixture = createClientFixture({
      profilePages: [
        [profile()],
        [
          {
            ...profile(),
            credential_version: 2,
          },
        ],
      ],
      authPages: [[authUser()], [], [authUser()], []],
    });
    fixture.listUsers.mockImplementation(async ({ page }) => ({
      data: { users: page === 1 ? [authUser()] : [] },
      error: null,
    }));
    fixture.range
      .mockResolvedValueOnce({ data: [profile()], error: null })
      .mockResolvedValueOnce({
        data: [{ ...profile(), credential_version: 2 }],
        error: null,
      });

    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      profilePageSize: 2,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });

    expect(outcome.ok).toBe(false);
    expect(
      outcome.report.categories.database_credential_version_mismatch,
    ).toBe(1);
  });

  it("reports completed updates when post-apply provider verification fails", async () => {
    const fixture = createClientFixture();
    fixture.listUsers.mockImplementation(async () =>
      fixture.listUsers.mock.calls.length === 1
        ? { data: { users: [authUser()] }, error: null }
        : {
            data: { users: [] },
            error: new Error(
              "raw verification error admin@example.com sb_secret_example",
            ),
          },
    );

    const outcome = await runAdminAuthMetadataBackfill({
      client: fixture.client,
      mode: "apply",
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      clock: () => new Date("2026-07-30T01:02:03.000Z"),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.report.counts.updated).toBe(1);
    expect(outcome.report.categories.verification_failed).toBe(1);
    expect(JSON.stringify(outcome.report)).not.toContain("raw verification");
  });
});
