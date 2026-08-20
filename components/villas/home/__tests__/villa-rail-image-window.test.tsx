/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VillaListing } from "@/lib/villas/types";

let reportActiveIndex: ((index: number) => void) | undefined;

vi.mock("@/components/ui/scroll-rail", () => ({
  ScrollRail: ({ children, onActiveIndexChange }: {
    children: React.ReactNode;
    onActiveIndexChange?: (index: number) => void;
  }) => {
    reportActiveIndex = onActiveIndexChange;
    return <div>{children}</div>;
  },
}));

vi.mock("../../listing/villa-card", () => ({
  VillaCard: ({ coverImageActive, villa }: {
    coverImageActive?: boolean;
    villa: VillaListing;
  }) => (
    <output
      data-cover-image-active={coverImageActive ? "true" : "false"}
      data-villa-id={villa.id}
    />
  ),
}));

import { VillaRail } from "../villa-rail";

const villa = (index: number): VillaListing => ({
  amenities: [], bathrooms: 1, bedrooms: 1, coverImage: null,
  distanceToSea: "500m", id: String(index), people: 2, poolType: "private",
  price: 1000, zone: "jomtien", zoneLabel: "Jomtien",
});

function activeVillaIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-cover-image-active="true"]'))
    .map((element) => element.getAttribute("data-villa-id") ?? "");
}

describe("VillaRail image activation window", () => {
  afterEach(() => {
    reportActiveIndex = undefined;
    vi.unstubAllGlobals();
  });

  it("grows its four-card image window without deactivating earlier cards", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaRail description="Recommended" title="Recommended" villas={[1, 2, 3, 4, 5, 6].map(villa)} />,
      );
    });

    expect(activeVillaIds(container)).toEqual(["1", "2", "3", "4"]);

    await act(async () => reportActiveIndex?.(1));
    expect(activeVillaIds(container)).toEqual(["1", "2", "3", "4", "5"]);

    await act(async () => reportActiveIndex?.(3));
    expect(activeVillaIds(container)).toEqual(["1", "2", "3", "4", "5", "6"]);

    await act(async () => reportActiveIndex?.(0));
    expect(activeVillaIds(container)).toEqual(["1", "2", "3", "4", "5", "6"]);

    act(() => root.unmount());
    container.remove();
  });

  it("prefetches and appends four-card continuation batches before the rail edge", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          hasMore: true,
          nextOffset: 8,
          villas: [4, 5, 6, 7].map(villa),
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          hasMore: false,
          nextOffset: 12,
          villas: [8, 9, 10].map(villa),
        }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ProgressiveVillaRail = VillaRail as React.ComponentType<
      React.ComponentProps<typeof VillaRail> & {
        continuationRailKey: string;
      }
    >;

    await act(async () => {
      root.render(
        <ProgressiveVillaRail
          continuationRailKey="critical-rail"
          description="Recommended"
          title="Recommended"
          villas={[1, 2, 3, 4].map(villa)}
        />,
      );
    });

    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4"]);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      reportActiveIndex?.(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/home-rail?rail=critical-rail&offset=4&exclude=1&exclude=2&exclude=3&exclude=4",
      expect.objectContaining({ cache: "force-cache", signal: expect.any(AbortSignal) }),
    );
    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7"]);

    await act(async () => {
      reportActiveIndex?.(4);
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/home-rail?rail=critical-rail&offset=8&exclude=1&exclude=2&exclude=3&exclude=4&exclude=5&exclude=6&exclude=7",
      expect.objectContaining({ cache: "force-cache", signal: expect.any(AbortSignal) }),
    );
    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);

    act(() => root.unmount());
    container.remove();
  });

  it("shows a recoverable continuation error and retries the same server cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        json: async () => ({
          hasMore: false,
          nextOffset: 8,
          villas: [5, 6].map(villa),
        }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ProgressiveVillaRail = VillaRail as React.ComponentType<
      React.ComponentProps<typeof VillaRail> & { continuationRailKey: string }
    >;

    await act(async () => {
      root.render(
        <ProgressiveVillaRail
          continuationRailKey="critical-rail"
          description="Recommended"
          title="Recommended"
          villas={[1, 2, 3, 4].map(villa)}
        />,
      );
    });
    await act(async () => reportActiveIndex?.(1));

    const retryButton = container.querySelector<HTMLButtonElement>(
      "[data-home-rail-retry]",
    );
    expect(container.querySelector('[data-home-rail-continuation="error"]')).not.toBeNull();
    expect(retryButton?.textContent).toContain("ลองอีกครั้ง");

    await act(async () => retryButton?.click());

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/home-rail?rail=critical-rail&offset=4&exclude=1&exclude=2&exclude=3&exclude=4",
      expect.objectContaining({ cache: "force-cache", signal: expect.any(AbortSignal) }),
    );
    expect(container.querySelector('[data-home-rail-continuation="error"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);

    act(() => root.unmount());
    container.remove();
  });

  it("accepts a cached pre-cursor response using the requested four-card window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          hasMore: false,
          villas: [5, 6].map(villa),
        }),
        ok: true,
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ProgressiveVillaRail = VillaRail as React.ComponentType<
      React.ComponentProps<typeof VillaRail> & { continuationRailKey: string }
    >;

    await act(async () => {
      root.render(
        <ProgressiveVillaRail
          continuationRailKey="critical-rail"
          description="Recommended"
          title="Recommended"
          villas={[1, 2, 3, 4].map(villa)}
        />,
      );
    });
    await act(async () => reportActiveIndex?.(1));

    expect(container.querySelector('[data-home-rail-continuation="error"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);

    act(() => root.unmount());
    container.remove();
  });

  it("rejects a server cursor that does not advance by exactly four", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          hasMore: true,
          nextOffset: 9,
          villas: [5, 6, 7, 8].map(villa),
        }),
        ok: true,
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VillaRail
          continuationRailKey="critical-rail"
          description="Recommended"
          title="Recommended"
          villas={[1, 2, 3, 4].map(villa)}
        />,
      );
    });
    await act(async () => reportActiveIndex?.(1));

    expect(container.querySelector('[data-home-rail-continuation="error"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-villa-id]")).toHaveLength(4);

    act(() => root.unmount());
    container.remove();
  });

  it("aborts an active continuation request when the rail unmounts", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        requestSignal = options?.signal ?? undefined;
        return new Promise(() => undefined);
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ProgressiveVillaRail = VillaRail as React.ComponentType<
      React.ComponentProps<typeof VillaRail> & { continuationRailKey: string }
    >;

    await act(async () => {
      root.render(
        <ProgressiveVillaRail
          continuationRailKey="critical-rail"
          description="Recommended"
          title="Recommended"
          villas={[1, 2, 3, 4].map(villa)}
        />,
      );
    });
    await act(async () => reportActiveIndex?.(1));
    expect(requestSignal?.aborted).toBe(false);

    act(() => root.unmount());
    expect(requestSignal?.aborted).toBe(true);
    container.remove();
  });
});
