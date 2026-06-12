import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPublicImageProxyResponse", () => {
  it("fetches upstream images without following redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("image bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicImageProxyResponse("https://assets.example.com/image.webp");

    expect(fetchMock).toHaveBeenCalledWith("https://assets.example.com/image.webp", {
      cache: "no-store",
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
  });

  it("cancels non-image upstream response bodies before rejecting them", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      cancel,
      start(controller) {
        controller.enqueue(new Uint8Array([60, 104, 116, 109, 108, 62]));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(
      fetchPublicImageProxyResponse("https://assets.example.com/not-image"),
    ).resolves.toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});
