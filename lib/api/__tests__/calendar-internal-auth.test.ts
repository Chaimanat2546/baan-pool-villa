import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { requireCalendarInternalBearer } from "@/lib/api/calendar-internal-auth";

type AuthTestInput = {
  authorization?: string;
  secret?: string;
};

function buildRequest(authorization?: string) {
  return new Request("https://example.com/api/villas/9/booking-calendar", {
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

async function authorize({ authorization, secret }: AuthTestInput) {
  if (secret === undefined) {
    vi.stubEnv("CALENDAR_INTERNAL_API_TOKEN", "");
  } else {
    vi.stubEnv("CALENDAR_INTERNAL_API_TOKEN", secret);
  }

  return requireCalendarInternalBearer(buildRequest(authorization));
}

async function expectStatus(input: AuthTestInput, expectedStatus: number) {
  const response = await authorize(input);

  expect(response).toBeInstanceOf(Response);
  expect(response?.status).toBe(expectedStatus);
  expect(response?.headers.get("Cache-Control")).toBe("private, no-store");

  if (expectedStatus === 401) {
    expect(response?.headers.get("WWW-Authenticate")).toBe("Bearer");
  }
}

async function expectAllowed(input: AuthTestInput) {
  await expect(authorize(input)).resolves.toBeNull();
}

describe("calendar internal bearer authorization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when the server credential is not configured", async () => {
    await expectStatus(
      { secret: undefined, authorization: undefined },
      503,
    );
  });

  it("returns 503 when the server credential is shorter than 32 characters", async () => {
    await expectStatus(
      {
        secret: "a".repeat(31),
        authorization: `Bearer ${"a".repeat(31)}`,
      },
      503,
    );
  });

  it("returns 401 when the bearer credential is missing", async () => {
    await expectStatus(
      { secret: "a".repeat(43), authorization: undefined },
      401,
    );
  });

  it("returns 401 when the bearer credential is invalid", async () => {
    await expectStatus(
      {
        secret: "a".repeat(43),
        authorization: "Bearer wrong",
      },
      401,
    );
  });

  it.each([
    `bearer ${"a".repeat(43)}`,
    `Bearer  ${"a".repeat(43)}`,
    `Bearer ${"a".repeat(43)} extra`,
    `Bearer ${"a".repeat(43)}, Bearer ${"a".repeat(43)}`,
  ])("rejects a non-exact Bearer credential: %s", async (authorization) => {
    await expectStatus(
      {
        secret: "a".repeat(43),
        authorization,
      },
      401,
    );
  });

  it("allows an exact bearer credential match", async () => {
    await expectAllowed({
      secret: "a".repeat(43),
      authorization: `Bearer ${"a".repeat(43)}`,
    });
  });
});
