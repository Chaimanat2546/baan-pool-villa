import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHomeConfigClient } from "@/lib/home-sections/supabase";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const OPAQUE_TOKEN = "opaque-admin-access-token";
const PROFILE_PROJECTION =
  "user_id,is_active,must_change_password,credential_version";

function makeClaimsResponse(options?: {
  credentialVersion?: unknown;
  omitCredentialVersion?: boolean;
  omitSub?: boolean;
  sub?: unknown;
}) {
  const appMetadata: Record<string, unknown> = {
    provider: "email",
    providers: ["email"],
  };
  const claims: Record<string, unknown> = {
    iss: "https://project.supabase.co/auth/v1",
    sub: options?.sub ?? ADMIN_ID,
    aud: "authenticated",
    exp: 1_900_000_000,
    iat: 1_800_000_000,
    role: "authenticated",
    aal: "aal1",
    session_id: "33333333-3333-4333-8333-333333333333",
    app_metadata: appMetadata,
    user_metadata: {},
  };

  if (!options?.omitCredentialVersion) {
    appMetadata.credential_version = options?.credentialVersion ?? 1;
  }

  if (options?.omitSub) {
    delete claims.sub;
  }

  return {
    data: {
      claims,
      header: {
        alg: "RS256",
        kid: "44444444-4444-4444-8444-444444444444",
        typ: "JWT",
      },
      signature: new Uint8Array([1, 2, 3]),
    },
    error: null,
  };
}

function makeUserResponse(options?: {
  credentialVersion?: unknown;
  id?: unknown;
  omitCredentialVersion?: boolean;
}) {
  const appMetadata: Record<string, unknown> = {
    provider: "email",
    providers: ["email"],
  };

  if (!options?.omitCredentialVersion) {
    appMetadata.credential_version = options?.credentialVersion ?? 1;
  }

  return {
    data: {
      user: {
        id: options?.id ?? ADMIN_ID,
        app_metadata: appMetadata,
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-07-29T00:00:00.000Z",
      },
    },
    error: null,
  };
}

function makeProfileRow(options?: {
  credentialVersion?: unknown;
  isActive?: unknown;
  mustChangePassword?: unknown;
  omitCredentialVersion?: boolean;
  userId?: unknown;
}) {
  const row: Record<string, unknown> = {
    user_id: options?.userId ?? ADMIN_ID,
    is_active: options?.isActive ?? true,
    must_change_password: options?.mustChangePassword ?? false,
  };

  if (!options?.omitCredentialVersion) {
    row.credential_version = options?.credentialVersion ?? 1;
  }

  return row;
}

function makeSupabaseClient(options?: {
  claimsResponse?: unknown;
  profileError?: unknown;
  rows?: unknown;
  userResponse?: unknown;
}) {
  const getClaims = vi
    .fn()
    .mockResolvedValue(options?.claimsResponse ?? makeClaimsResponse());
  const getUser = vi
    .fn()
    .mockResolvedValue(options?.userResponse ?? makeUserResponse());
  const limit = vi.fn().mockResolvedValue({
    data: options?.rows ?? [makeProfileRow()],
    error: options?.profileError ?? null,
  });
  const queryBuilder: {
    eq: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    limit,
    select: vi.fn(),
  };
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  const from = vi.fn().mockReturnValue(queryBuilder);
  const client = {
    auth: { getClaims, getUser },
    from,
  };

  return {
    client,
    from,
    getClaims,
    getUser,
    limit,
    queryBuilder,
  };
}

async function loadAssertHomeConfigAdmin() {
  const { assertHomeConfigAdmin } = await import("../home-config-auth");
  return assertHomeConfigAdmin;
}

describe("home config admin auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("verifies an identical token from scratch on every authorization attempt", async () => {
    const first = makeSupabaseClient();
    const second = makeSupabaseClient();
    createHomeConfigClientMock
      .mockReturnValueOnce(first.client as never)
      .mockReturnValueOnce(second.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    const firstResult = await assertHomeConfigAdmin(OPAQUE_TOKEN);
    const secondResult = await assertHomeConfigAdmin(OPAQUE_TOKEN);

    expect(firstResult).toEqual({ ok: true, supabase: first.client });
    expect(secondResult).toEqual({ ok: true, supabase: second.client });
    expect(createHomeConfigClientMock).toHaveBeenNthCalledWith(1, OPAQUE_TOKEN);
    expect(createHomeConfigClientMock).toHaveBeenNthCalledWith(2, OPAQUE_TOKEN);

    for (const fixture of [first, second]) {
      expect(fixture.getClaims).toHaveBeenCalledOnce();
      expect(fixture.getClaims).toHaveBeenCalledWith(OPAQUE_TOKEN);
      expect(fixture.getUser).toHaveBeenCalledOnce();
      expect(fixture.getUser).toHaveBeenCalledWith(OPAQUE_TOKEN);
      expect(fixture.from).toHaveBeenCalledWith("admin_users");
      expect(fixture.queryBuilder.select).toHaveBeenCalledWith(
        PROFILE_PROJECTION,
      );
      expect(fixture.queryBuilder.eq).toHaveBeenCalledOnce();
      expect(fixture.queryBuilder.eq).toHaveBeenCalledWith(
        "user_id",
        ADMIN_ID,
      );
      expect(fixture.limit).toHaveBeenCalledWith(2);
    }
  });

  it.each([
    [
      "getClaims throws synchronously",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getClaims.mockImplementationOnce(() => {
          throw new Error("claims failed");
        });
      },
    ],
    [
      "getClaims rejects",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getClaims.mockRejectedValueOnce(new Error("claims failed"));
      },
    ],
    [
      "getClaims returns an error",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getClaims.mockResolvedValueOnce({
          data: null,
          error: new Error("claims failed"),
        });
      },
    ],
    [
      "getClaims returns no data",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getClaims.mockResolvedValueOnce({ data: null, error: null });
      },
    ],
    [
      "getUser throws synchronously",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getUser.mockImplementationOnce(() => {
          throw new Error("user failed");
        });
      },
    ],
    [
      "getUser rejects",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getUser.mockRejectedValueOnce(new Error("user failed"));
      },
    ],
    [
      "getUser returns an error",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: new Error("user failed"),
        });
      },
    ],
    [
      "getUser returns no user",
      (fixture: ReturnType<typeof makeSupabaseClient>) => {
        fixture.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });
      },
    ],
  ])(
    "returns session_invalid after %s while still invoking both Auth verifiers",
    async (_name, arrange) => {
      const fixture = makeSupabaseClient();
      arrange(fixture);
      createHomeConfigClientMock.mockReturnValue(fixture.client as never);
      const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

      await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toMatchObject({
        ok: false,
        code: "session_invalid",
        status: 401,
      });
      expect(fixture.getClaims).toHaveBeenCalledOnce();
      expect(fixture.getClaims).toHaveBeenCalledWith(OPAQUE_TOKEN);
      expect(fixture.getUser).toHaveBeenCalledOnce();
      expect(fixture.getUser).toHaveBeenCalledWith(OPAQUE_TOKEN);
      expect(fixture.from).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing claims sub", makeClaimsResponse({ omitSub: true })],
    ["blank claims sub", makeClaimsResponse({ sub: "   " })],
    ["non-string claims sub", makeClaimsResponse({ sub: 42 })],
    ["stale claims sub", makeClaimsResponse({ sub: OTHER_ADMIN_ID })],
  ])("rejects %s as session_invalid", async (_name, claimsResponse) => {
    const fixture = makeSupabaseClient({ claimsResponse });
    createHomeConfigClientMock.mockReturnValue(fixture.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toMatchObject({
      ok: false,
      code: "session_invalid",
      status: 401,
    });
    expect(fixture.getClaims).toHaveBeenCalledOnce();
    expect(fixture.getUser).toHaveBeenCalledOnce();
    expect(fixture.from).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", "jwt", undefined],
    ["zero", "jwt", 0],
    ["negative", "jwt", -1],
    ["fractional", "jwt", 1.5],
    ["mismatched", "jwt", 2],
    ["missing", "current Auth", undefined],
    ["zero", "current Auth", 0],
    ["negative", "current Auth", -1],
    ["fractional", "current Auth", 1.5],
    ["mismatched", "current Auth", 2],
    ["missing", "database", undefined],
    ["zero", "database", 0],
    ["negative", "database", -1],
    ["fractional", "database", 1.5],
    ["mismatched", "database", 2],
  ])(
    "rejects a %s %s credential version",
    async (_case, source, version) => {
      const claimsResponse =
        source === "jwt"
          ? makeClaimsResponse({
              credentialVersion: version,
              omitCredentialVersion: version === undefined,
            })
          : makeClaimsResponse();
      const userResponse =
        source === "current Auth"
          ? makeUserResponse({
              credentialVersion: version,
              omitCredentialVersion: version === undefined,
            })
          : makeUserResponse();
      const rows = [
        source === "database"
          ? makeProfileRow({
              credentialVersion: version,
              omitCredentialVersion: version === undefined,
            })
          : makeProfileRow(),
      ];
      const fixture = makeSupabaseClient({
        claimsResponse,
        rows,
        userResponse,
      });
      createHomeConfigClientMock.mockReturnValue(fixture.client as never);
      const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

      await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toMatchObject({
        ok: false,
        code: "credential_version_mismatch",
        status: 403,
      });
      expect(fixture.getClaims).toHaveBeenCalledOnce();
      expect(fixture.getUser).toHaveBeenCalledOnce();

      if (source === "database" || _case === "mismatched") {
        expect(fixture.from).toHaveBeenCalledOnce();
      } else {
        expect(fixture.from).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ["zero rows", "admin_inactive", []],
    [
      "two rows",
      "admin_inactive",
      [makeProfileRow(), makeProfileRow()],
    ],
    [
      "a malformed row",
      "admin_inactive",
      [makeProfileRow({ isActive: "true" })],
    ],
    [
      "a wrong-UID row",
      "admin_inactive",
      [makeProfileRow({ userId: OTHER_ADMIN_ID })],
    ],
    [
      "an inactive row",
      "admin_inactive",
      [makeProfileRow({ isActive: false })],
    ],
    [
      "a forced-change row",
      "password_change_required",
      [makeProfileRow({ mustChangePassword: true })],
    ],
  ])("rejects %s with %s", async (_name, code, rows) => {
    const fixture = makeSupabaseClient({ rows });
    createHomeConfigClientMock.mockReturnValue(fixture.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toMatchObject({
      ok: false,
      code,
      status: 403,
    });
    expect(fixture.queryBuilder.select).toHaveBeenCalledWith(
      PROFILE_PROJECTION,
    );
    expect(fixture.queryBuilder.eq).toHaveBeenCalledWith("user_id", ADMIN_ID);
    expect(fixture.limit).toHaveBeenCalledWith(2);
  });

  it("returns the same scoped client only for an exact valid identity, version, and profile match", async () => {
    const fixture = makeSupabaseClient();
    createHomeConfigClientMock.mockReturnValue(fixture.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toEqual({
      ok: true,
      supabase: fixture.client,
    });
    expect(fixture.getClaims).toHaveBeenCalledWith(OPAQUE_TOKEN);
    expect(fixture.getUser).toHaveBeenCalledWith(OPAQUE_TOKEN);
    expect(fixture.queryBuilder.select).toHaveBeenCalledWith(
      PROFILE_PROJECTION,
    );
    expect(fixture.queryBuilder.eq).toHaveBeenCalledWith("user_id", ADMIN_ID);
    expect(fixture.limit).toHaveBeenCalledWith(2);
  });

  it("keeps a PostgREST profile-query failure distinct from a login failure", async () => {
    const fixture = makeSupabaseClient({
      profileError: {
        message: "permission denied for admin_users",
        code: "42501",
        details: "RLS denied the profile read",
        hint: "Check the self-select policy",
      },
    });
    createHomeConfigClientMock.mockReturnValue(fixture.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toEqual({
      ok: false,
      message:
        "Unable to verify admin access: permission denied for admin_users",
      code: "admin_verification_failed",
      status: 500,
      supabaseCode: "42501",
      details: "RLS denied the profile read",
      hint: "Check the self-select policy",
    });
  });

  it("contains a rejected profile query as admin_verification_failed", async () => {
    const fixture = makeSupabaseClient();
    fixture.limit.mockRejectedValueOnce(new Error("database unavailable"));
    createHomeConfigClientMock.mockReturnValue(fixture.client as never);
    const assertHomeConfigAdmin = await loadAssertHomeConfigAdmin();

    await expect(assertHomeConfigAdmin(OPAQUE_TOKEN)).resolves.toEqual({
      ok: false,
      message: "Unable to verify admin access.",
      code: "admin_verification_failed",
      status: 500,
    });
  });
});
