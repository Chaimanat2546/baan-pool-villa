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

  it("follows safe canonical redirects before proxying the image", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            Location:
              "https://www.devillegroups.com/imgs/profile_imgs_large/501.jpg",
          },
          status: 301,
        }),
      )
      .mockResolvedValueOnce(
        new Response("image bytes", {
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicImageProxyResponse(
      "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
    );

    await expect(response?.text()).resolves.toBe("image bytes");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.devillegroups.com/imgs/profile_imgs_large/501.jpg",
      {
        cache: "no-store",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("rejects redirects to a different image resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: {
          Location: "https://www.devillegroups.com/imgs/profile_imgs_large/other.jpg",
        },
        status: 302,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPublicImageProxyResponse(
        "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
      ),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
