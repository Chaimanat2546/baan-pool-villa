/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { lockAdminDialogScroll } from "../admin-dialog-scroll-lock";

describe("admin dialog scroll locks", () => {
  it.each([true, false])("restores existing overflow after nested dialogs close, outerFirst=%s", outerFirst => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "scroll";
    const outer = lockAdminDialogScroll();
    const inner = lockAdminDialogScroll();
    const first = outerFirst ? outer : inner;
    const last = outerFirst ? inner : outer;
    first();
    first();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    last();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  });
});
