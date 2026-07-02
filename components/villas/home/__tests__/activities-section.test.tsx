import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ActivitiesSection } from "../activities-section";

interface MockImageProps {
  alt: string;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, src }: MockImageProps) =>
    createElement("span", { "aria-label": alt, "data-src": src }),
}));

describe("ActivitiesSection", () => {
  it("renders nothing without advertisements", () => {
    expect(
      renderToStaticMarkup(
        createElement(ActivitiesSection, { advertisements: [] }),
      ),
    ).toBe("");
  });

  it("renders advertisement cards without fake links", () => {
    const markup = renderToStaticMarkup(
      createElement(ActivitiesSection, {
        advertisements: [
          {
            id: "ad-1",
            imageUrl:
              "https://webook-media.poolvilla.workers.dev/advertisements/ad-1/activity.webp",
            title: "กิจกรรมทางทะเล",
          },
        ],
      }),
    );

    expect(markup).toContain('data-home-activities="true"');
    expect(markup).toContain("กิจกรรมที่น่าสนใจ");
    expect(markup).toContain("กิจกรรมทางทะเล");
    expect(markup).toContain(
      'data-src="https://webook-media.poolvilla.workers.dev/advertisements/ad-1/activity.webp"',
    );
    expect(markup).not.toContain("<a ");
  });
});
