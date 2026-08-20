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

  it("renders its complete initial payload without a continuation request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <VillaRail
          description="Recommended"
          title="Recommended"
          villas={Array.from({ length: 12 }, (_, index) => villa(index + 1))}
        />,
      );
    });

    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      reportActiveIndex?.(1);
    });
    expect(
      Array.from(container.querySelectorAll("[data-villa-id]")).map(
        (element) => element.getAttribute("data-villa-id"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);

    await act(async () => reportActiveIndex?.(5));
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
      "11",
      "12",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-home-rail-continuation]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
