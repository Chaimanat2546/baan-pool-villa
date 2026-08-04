/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { ImageWithSkeleton } from "../image-with-skeleton";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ImageWithSkeleton", () => {
  it("returns to its loading state when its source changes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <div className="relative size-24">
          <ImageWithSkeleton alt="Image A" fill src="/api/images/a.webp" />
        </div>,
      );
    });

    const imageA = container.querySelector("img");
    expect(imageA).not.toBeNull();
    await act(async () => {
      imageA?.dispatchEvent(new Event("load", { bubbles: true }));
    });
    expect(container.querySelector("[data-image-loading-skeleton]")).toBeNull();

    await act(async () => {
      root.render(
        <div className="relative size-24">
          <ImageWithSkeleton alt="Image B" fill src="/api/images/b.webp" />
        </div>,
      );
    });

    expect(container.querySelector("[data-image-loading-skeleton]")).not.toBeNull();

    const imageB = container.querySelector("img");
    await act(async () => {
      imageB?.dispatchEvent(new Event("load", { bubbles: true }));
    });
    expect(container.querySelector("[data-image-loading-skeleton]")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
