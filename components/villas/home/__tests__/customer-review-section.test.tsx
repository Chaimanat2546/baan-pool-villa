/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { CustomerReviewSection } from "../customer-review-section";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("CustomerReviewSection", () => {
  it("uses the semantic text token for lightbox controls on white", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CustomerReviewSection
          data={{
            images: [
              {
                alt: "Review",
                id: "review-1",
                url: "https://example.com/review.jpg",
              },
              {
                alt: "Review two",
                id: "review-2",
                url: "https://example.com/review-2.jpg",
              },
            ],
            layout: "carousel",
          }}
        />,
      );
    });

    const imageButton = container.querySelector("button");
    expect(imageButton).not.toBeNull();
    await act(async () => {
      imageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(Array.from(dialog?.querySelectorAll("button") ?? [])).toHaveLength(
      3,
    );
    for (const button of dialog?.querySelectorAll("button") ?? []) {
      expect(button.className).toContain("text-[var(--site-text)]");
    }
    expect(dialog?.querySelector("figcaption")?.className).toContain(
      "text-[var(--site-text)]",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
