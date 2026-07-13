/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VillaFilters } from "@/lib/villas/types";

import { SearchBar } from "../search-bar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const filters: VillaFilters = {
  amenities: [],
  bedrooms: 1,
  guests: 2,
  maxPrice: 20_000,
  nearSeaOnly: false,
  zone: "all",
};

describe("SearchBar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("selects more than ten guests from the combobox", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = vi.fn();
    document.body.append(container);

    await act(async () => {
      root.render(
        <SearchBar
          filters={filters}
          maxAvailablePrice={20_000}
          onChange={onChange}
          onSearch={vi.fn()}
          zones={[]}
        />,
      );
    });

    const guestCombobox = container.querySelector<HTMLButtonElement>(
      'button[aria-label="จำนวนผู้เข้าพัก"]',
    );

    expect(guestCombobox).not.toBeNull();

    await act(async () => {
      guestCombobox?.click();
    });

    const moreThanTen = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes("มากกว่า 10"));

    expect(moreThanTen).not.toBeUndefined();

    await act(async () => {
      moreThanTen?.click();
    });

    expect(onChange).toHaveBeenCalledWith({ ...filters, guests: 11 });

    await act(async () => {
      root.unmount();
    });
  });
});
