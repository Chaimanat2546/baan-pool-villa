import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "../json-ld";

describe("serializeJsonLd", () => {
  it("escapes HTML tag starts in JSON-LD script payloads", () => {
    const payload = {
      "@context": "https://schema.org",
      "@type": "Thing",
      description: "</script><script>alert(1)</script>",
    };

    const serialized = serializeJsonLd(payload);

    expect(serialized).toBe(
      '{"@context":"https://schema.org","@type":"Thing","description":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}',
    );
    expect(serialized).not.toContain("<");
  });
});
