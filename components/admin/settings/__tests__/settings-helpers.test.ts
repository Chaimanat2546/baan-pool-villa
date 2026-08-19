import { describe, expect, it } from "vitest";

import {
  addPhoneContact,
  getSafePreviewImageUrl,
  removePhoneContact,
  updatePhoneContact,
} from "../settings-helpers";

describe("section settings helpers", () => {
  it("updates, adds, and removes phone contacts while keeping one", () => {
    const contacts = [{ name: "Main", phone: "0812345678", time: "09:00" }];
    const updated = updatePhoneContact(contacts, 0, { name: "Sales" });
    const added = addPhoneContact(updated);

    expect(updated).toEqual([{ ...contacts[0], name: "Sales" }]);
    expect(removePhoneContact(added, 1)).toEqual(updated);
    expect(removePhoneContact(updated, 0)).toEqual(updated);
  });

  it("does not add a fifth phone contact", () => {
    const contacts = Array.from({ length: 4 }, (_, index) => ({
      name: `Contact ${index + 1}`,
      phone: `081234567${index}`,
      time: "09:00",
    }));

    expect(addPhoneContact(contacts)).toEqual(contacts);
  });

  it("accepts only local or HTTP preview image URLs", () => {
    expect(getSafePreviewImageUrl("/hero.webp", "/fallback.webp")).toBe("/hero.webp");
    expect(getSafePreviewImageUrl("javascript:alert(1)", "/fallback.webp")).toBe("/fallback.webp");
  });
});
