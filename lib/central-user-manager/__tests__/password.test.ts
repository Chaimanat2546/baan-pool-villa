import { describe, expect, it, vi } from "vitest";

import { generateTemporaryPassword } from "../password";

function deterministicCrypto(values: number[]) {
  let index = 0;
  let calls = 0;

  return {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        calls += 1;
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
          values[index++] ?? 0,
        );
        return array;
      },
    } as Pick<Crypto, "getRandomValues">,
    get calls() {
      return calls;
    },
  };
}

describe("generateTemporaryPassword", () => {
  it("creates a 20-character printable nonspace ASCII password with every required class", () => {
    const password = generateTemporaryPassword(deterministicCrypto([0]).crypto);

    expect(password).toMatch(/^[!-~]{20}$/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("uses injected Web Crypto with rejection sampling and never Math.random", () => {
    const random = deterministicCrypto([255, 0]);
    const mathRandom = vi
      .spyOn(Math, "random")
      .mockImplementation(() => {
        throw new Error("Math.random must not be used");
      });

    try {
      expect(generateTemporaryPassword(random.crypto)).toMatch(/^[!-~]{20}$/);
      expect(random.calls).toBeGreaterThan(39);
    } finally {
      mathRandom.mockRestore();
    }
  });
});
