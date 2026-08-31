import { FaHotTubPerson, FaTableTennisPaddleBall } from "react-icons/fa6";
import { GiBarbecue, GiHockey, GiKidSlide, GiPoolTriangle } from "react-icons/gi";
import { MicVocal, PawPrint, Star, Wifi } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_AMENITY_PREVIEW_COUNT,
  getAmenityIcon,
} from "../content-amenities";

describe("detail content amenity helpers", () => {
  it("uses specific amenity icons and a safe fallback", () => {
    expect(DEFAULT_AMENITY_PREVIEW_COUNT).toBe(12);
    expect(getAmenityIcon("wifi")).toBe(Wifi);
    expect(getAmenityIcon("grill")).toBe(GiBarbecue);
    expect(getAmenityIcon("billard")).toBe(GiPoolTriangle);
    expect(getAmenityIcon("tabletennis")).toBe(FaTableTennisPaddleBall);
    expect(getAmenityIcon("airhockey")).toBe(GiHockey);
    expect(getAmenityIcon("jacuzzi")).toBe(FaHotTubPerson);
    expect(getAmenityIcon("slider")).toBe(GiKidSlide);
    expect(getAmenityIcon("karaoke")).toBe(MicVocal);
    expect(getAmenityIcon("pet")).toBe(PawPrint);
    expect(getAmenityIcon("unknown")).toBe(Star);
    expect(getAmenityIcon("__proto__")).toBe(Star);
  });
});
