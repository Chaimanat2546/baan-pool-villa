import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { requireCentralBearer } from "../bearer-auth";

const VALID_TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const DIFFERENT_VALID_TOKEN = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

function requestWithAuthorization(authorization?: string) {
  return new Request("https://example.com/api/central-user-manager", {
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

function requestWithDuplicateAuthorization(first: string, second: string) {
  const headers = new Headers();
  headers.append("Authorization", first);
  headers.append("Authorization", second);

  return new Request("https://example.com/api/central-user-manager", {
    headers,
  });
}

async function expectUnauthorized(request: Request) {
  const response = await requireCentralBearer(request, VALID_TOKEN, 7);

  expect(response).toBeInstanceOf(Response);
  expect(response).toMatchObject({ status: 401 });
  expect((response as Response).headers.get("WWW-Authenticate")).toBe(
    "Bearer",
  );
  expect((response as Response).headers.get("Cache-Control")).toBe(
    "private, no-store",
  );
  expect((response as Response).headers.get("X-Content-Type-Options")).toBe(
    "nosniff",
  );
  await expect((response as Response).json()).resolves.not.toEqual(
    expect.objectContaining({ error: expect.stringContaining(VALID_TOKEN) }),
  );
}

describe("central user manager bearer authorization", () => {
  it("returns the configured token version for an exact credential", async () => {
    await expect(
      requireCentralBearer(
        requestWithAuthorization(`Bearer ${VALID_TOKEN}`),
        VALID_TOKEN,
        42,
      ),
    ).resolves.toEqual({ tokenVersion: 42 });
  });

  it.each([
    ["missing header", requestWithAuthorization()],
    [
      "duplicate headers combined by the request runtime",
      requestWithDuplicateAuthorization(
        `Bearer ${VALID_TOKEN}`,
        `Bearer ${VALID_TOKEN}`,
      ),
    ],
    ["comma-joined credentials", requestWithAuthorization(`Bearer ${VALID_TOKEN}, Bearer ${VALID_TOKEN}`)],
    ["lowercase scheme", requestWithAuthorization(`bearer ${VALID_TOKEN}`)],
    ["mixed-case scheme", requestWithAuthorization(`BeArEr ${VALID_TOKEN}`)],
    ["tab separator", requestWithAuthorization(`Bearer\t${VALID_TOKEN}`)],
    ["double-space separator", requestWithAuthorization(`Bearer  ${VALID_TOKEN}`)],
    ["trailing data", requestWithAuthorization(`Bearer ${VALID_TOKEN} extra`)],
    ["invalid base64url character", requestWithAuthorization(`Bearer ${"!".repeat(43)}`)],
    ["42-character token", requestWithAuthorization(`Bearer ${"A".repeat(42)}`)],
    ["44-character token", requestWithAuthorization(`Bearer ${"A".repeat(44)}`)],
    ["wrong token", requestWithAuthorization(`Bearer ${DIFFERENT_VALID_TOKEN}`)],
  ])("returns 401 for %s", async (_description, request) => {
    await expectUnauthorized(request);
  });

  it("returns a secret-safe 503 for malformed expected configuration", async () => {
    const malformedExpected = "A".repeat(42);
    const response = await requireCentralBearer(
      requestWithAuthorization(`Bearer ${VALID_TOKEN}`),
      malformedExpected,
      7,
    );

    expect(response).toBeInstanceOf(Response);
    expect(response).toMatchObject({ status: 503 });
    expect((response as Response).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect((response as Response).headers.get("X-Content-Type-Options")).toBe(
      "nosniff",
    );
    expect((response as Response).headers.get("WWW-Authenticate")).toBeNull();
    await expect((response as Response).text()).resolves.not.toContain(
      malformedExpected,
    );
  });

  it("hashes both valid token strings and compares all 32 SHA-256 digest bytes", async () => {
    const digestInputs: string[] = [];
    const digest = vi.fn(async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
      digestInputs.push(new TextDecoder().decode(data));
      const output = new Uint8Array(32);

      if (digestInputs.length === 2) {
        output[31] = 1;
      }

      return output.buffer;
    });
    const cryptoDependency = { subtle: { digest } } as Pick<Crypto, "subtle">;

    await expect(
      requireCentralBearer(
        requestWithAuthorization(`Bearer ${DIFFERENT_VALID_TOKEN}`),
        VALID_TOKEN,
        7,
        cryptoDependency,
      ),
    ).resolves.toMatchObject({ status: 401 });

    expect(digest).toHaveBeenCalledTimes(2);
    expect(digest).toHaveBeenNthCalledWith(1, "SHA-256", expect.any(Uint8Array));
    expect(digest).toHaveBeenNthCalledWith(2, "SHA-256", expect.any(Uint8Array));
    expect(digestInputs).toEqual([VALID_TOKEN, DIFFERENT_VALID_TOKEN]);
  });
});
