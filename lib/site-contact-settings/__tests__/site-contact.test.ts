import { describe, expect, it } from "vitest";

import {
  buildContactLinks,
  buildPhoneHref,
  withPhoneHref,
} from "@/lib/site-contact";

describe("site contact links", () => {
  it("keeps phone and channel link behavior", () => {
    expect(buildPhoneHref("061-748-5213")).toBe("tel:0617485213");
    expect(buildPhoneHref("no phone")).toBe("#");
    expect(
      withPhoneHref({ name: "Game", phone: "061-748-5213", time: "day" }),
    ).toEqual({
      name: "Game",
      phone: "061-748-5213",
      time: "day",
      href: "tel:0617485213",
    });
    expect(
      buildContactLinks({
        phoneContacts: [],
        messengerUrl: "https://example.com/messenger",
        showFacebookTimeline: true,
        lineId: "@line",
        lineUrl: "https://example.com/line",
      }),
    ).toEqual({
      messenger: "https://example.com/messenger",
      line: "https://example.com/line",
    });
  });
});
