import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildResolvedPublicImageProxyResponse,
  fetchPublicImageProxyResponse,
} from "@/lib/public-image-proxy-server";

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

  it("fetches private poolvilla S3 images through the existing image loader", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("image bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicImageProxyResponse(
      "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/pool image.jpg",
      { quality: 60, width: 828 },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/pool%20image.jpg?w=828&q=60",
      {
        cache: "no-store",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("retries one transient upstream image failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 502 }))
      .mockResolvedValueOnce(
        new Response("image bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicImageProxyResponse(
      "https://assets.example.com/image.webp",
    );

    expect(response).not.toBeNull();
    await expect(response!.text()).resolves.toBe("image bytes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns no proxy response when the upstream connection is lost", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network connection lost.")),
    );

    await expect(
      fetchPublicImageProxyResponse("https://assets.example.com/image.webp"),
    ).resolves.toBeNull();
  });

  it("ends quietly when the browser cancels an image request", async () => {
    const controller = new AbortController();
    const request = new Request("https://example.com/api/houses/images/1745?w=292", {
      signal: controller.signal,
    });
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = buildResolvedPublicImageProxyResponse(
      request,
      "https://assets.example.com/image.webp",
    );
    controller.abort();

    const response = await responsePromise;

    expect(fetchMock).toHaveBeenCalledWith(
      "https://assets.example.com/image.webp",
      expect.objectContaining({
        cache: "no-store",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(response.status).toBe(204);
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

  it("rejects malformed redirect locations without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: {
          Location: "https://[",
        },
        status: 302,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPublicImageProxyResponse("https://assets.example.com/image.jpg"),
    ).resolves.toBeNull();
  });
});
