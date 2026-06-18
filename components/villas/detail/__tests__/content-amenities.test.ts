import { Flame, Music, PawPrint, Star, Wifi } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_AMENITY_PREVIEW_COUNT,
  getAmenityIcon,
} from "../content-amenities";

describe("detail content amenity helpers", () => {
  it("keeps stable icons for known amenities and a safe fallback", () => {
    expect(DEFAULT_AMENITY_PREVIEW_COUNT).toBe(12);
    expect(getAmenityIcon("wifi")).toBe(Wifi);
    expect(getAmenityIcon("grill")).toBe(Flame);
    expect(getAmenityIcon("karaoke")).toBe(Music);
    expect(getAmenityIcon("pet")).toBe(PawPrint);
    expect(getAmenityIcon("unknown")).toBe(Star);
    expect(getAmenityIcon("__proto__")).toBe(Star);
  });
});
