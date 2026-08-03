import { describe, expect, it } from "vitest";

import { readBoundedRequestBytes, sha256Hex } from "../route-response";

describe("bounded internal request bytes", () => {
  it("accepts exactly 16,384 streamed bytes and rejects byte 16,385", async () => {
    const accepted = new Request("https://example.com/change-password", {
      method: "POST",
      body: new Uint8Array(16_384),
    });
    const rejected = new Request("https://example.com/change-password", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(16_000));
          controller.enqueue(new Uint8Array(385));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedRequestBytes(accepted)).resolves.toMatchObject({
      ok: true,
      bytes: expect.objectContaining({ byteLength: 16_384 }),
    });
    await expect(readBoundedRequestBytes(rejected)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("prechecks only a valid oversized Content-Length and still streams without trusting it", async () => {
    let oversizedBodyRead = false;
    const prechecked = {
      headers: new Headers({ "Content-Length": "16385" }),
      get body() {
        oversizedBodyRead = true;
        return null;
      },
    } as unknown as Request;
    const untrustedHeader = new Request("https://example.com/change-password", {
      method: "POST",
      headers: { "Content-Length": "1" },
      body: new Uint8Array(16_385),
    });

    await expect(readBoundedRequestBytes(prechecked)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(oversizedBodyRead).toBe(false);
    await expect(readBoundedRequestBytes(untrustedHeader)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("hashes the exact accepted bytes to lowercase SHA-256 hex", async () => {
    await expect(
      sha256Hex(new TextEncoder().encode('{"tenantId":"exact"}')),
    ).resolves.toBe(
      "f8303573da7039ab7dd4d89b67fa88d89ee15fc5b80369422c7a45b720885e9c",
    );
  });
});
