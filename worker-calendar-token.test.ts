import { describe, expect, it } from "vitest";

import {
  createBookingCalendarToken,
  verifyBookingCalendarToken,
} from "./worker-calendar-token.js";

const secret = "calendar-access-secret-with-at-least-32-characters";
const requestBinding = {
  clientIp: "203.0.113.10",
  userAgent: "Calendar Browser/1.0",
  villaId: "1981",
};
const issuedAtMs = Date.parse("2026-07-24T05:00:00.000Z");
const nonceBytes = new Uint8Array([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
]);

async function issueToken() {
  return createBookingCalendarToken({
    ...requestBinding,
    nowMs: issuedAtMs,
    nonceBytes,
    secret,
  });
}

function tamperToken(token: string) {
  const parts = token.split(".");
  const signature = parts[3] ?? "";

  parts[3] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

  return parts.join(".");
}

describe("booking calendar access token", () => {
  it("creates a five-minute token valid for the same request binding", async () => {
    const result = await issueToken();

    expect(result.expiresAt).toBe(issuedAtMs + 5 * 60_000);
    await expect(
      verifyBookingCalendarToken({
        ...requestBinding,
        nowMs: issuedAtMs + 60_000,
        secret,
        token: result.token,
      }),
    ).resolves.toMatchObject({
      valid: true,
    });
  });

  it.each([
    ["another villa", { villaId: "1982" }],
    ["another IP", { clientIp: "203.0.113.11" }],
    ["another User-Agent", { userAgent: "Proxy Bot/1.0" }],
  ])("rejects a token used with %s", async (_label, overrides) => {
    const result = await issueToken();

    await expect(
      verifyBookingCalendarToken({
        ...requestBinding,
        ...overrides,
        nowMs: issuedAtMs + 60_000,
        secret,
        token: result.token,
      }),
    ).resolves.toEqual({ valid: false, reason: "signature" });
  });

  it("rejects expired, tampered, and malformed tokens", async () => {
    const result = await issueToken();
    const tamperedToken = tamperToken(result.token);

    await expect(
      verifyBookingCalendarToken({
        ...requestBinding,
        nowMs: result.expiresAt,
        secret,
        token: result.token,
      }),
    ).resolves.toEqual({ valid: false, reason: "expired" });
    await expect(
      verifyBookingCalendarToken({
        ...requestBinding,
        nowMs: issuedAtMs,
        secret,
        token: tamperedToken,
      }),
    ).resolves.toEqual({ valid: false, reason: "signature" });
    await expect(
      verifyBookingCalendarToken({
        ...requestBinding,
        nowMs: issuedAtMs,
        secret,
        token: "not-a-token",
      }),
    ).resolves.toEqual({ valid: false, reason: "format" });
  });

  it("rejects missing or short secrets", async () => {
    await expect(
      createBookingCalendarToken({
        ...requestBinding,
        nowMs: issuedAtMs,
        nonceBytes,
        secret: "short",
      }),
    ).rejects.toThrow("Calendar access secret must be at least 32 characters.");
  });
});
