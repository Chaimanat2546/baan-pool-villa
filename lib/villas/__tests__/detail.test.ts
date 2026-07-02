import { describe, expect, it } from "vitest";
import { buildVillaDetailContent } from "../detail";

describe("buildVillaDetailContent", () => {
  it("extracts guest-facing facts, notes, nearby places, and amenities from the raw detail API", () => {
    const content = buildVillaDetailContent({
      h_time_checkin: "14:00:00",
      h_time_checkout: "12:00:00",
      h_extra: "500",
      h_insurance: "5000",
      location: "à¸•à¸£à¸‡à¸‚à¹‰à¸²à¸¡à¸«à¸²à¸”à¸žà¸±à¸—à¸¢à¸²à¸à¸¥à¸²à¸‡",
      sea: "8.5 à¸à¸¡.",
      h_additional_costs: "-à¹„à¸Ÿà¸Ÿà¸£à¸µ 100 à¸«à¸™à¹ˆà¸§à¸¢\r\nà¹€à¸à¸´à¸™à¸«à¸™à¹ˆà¸§à¸¢à¸¥à¸° 7 à¸šà¸²à¸—",
      h_kitchen_ware: "- à¹„à¸¡à¹‚à¸„à¸£à¹€à¸§à¸Ÿ\r\n- à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸„à¸£à¸±à¸§à¹„à¸—à¸¢à¸„à¸£à¸š",
      h_moredetail: "-à¸«à¹‰à¸­à¸‡à¸™à¸­à¸™à¸¡à¸µ TV à¸—à¸¸à¸à¸«à¹‰à¸­à¸‡",
      h_parking: "- à¸ˆà¸­à¸”à¹ƒà¸™à¸šà¹‰à¸²à¸™ 13 à¸„à¸±à¸™",
      h_swimmingpool: "- à¸à¸§à¹‰à¸²à¸‡ 3.5 à¸¡. à¸¢à¸²à¸§ 8 à¸¡.",
      h_bedroom_detail: "à¸«à¹‰à¸­à¸‡à¸™à¸­à¸™à¸—à¸µà¹ˆ 1: à¹€à¸•à¸µà¸¢à¸‡ 6 à¸Ÿà¸¸à¸•",
      h_people_max: "25",
      h_videos: "https://youtu.be/dQw4w9WgXcQ\nhttps://example.com/review-video",
      facilities: {
        wifi: "y",
        karaoke: "y",
        swimming_pool: "y",
        pets: "y",
        private_pool: "y",
        extra_bed: "y",
        pet_detail: "à¸™à¹‰à¸­à¸‡à¸«à¸¡à¸²à¹à¸¡à¸§à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5 à¸à¸´à¹‚à¸¥à¸à¸£à¸±à¸¡ à¸•à¸±à¸§à¸¥à¸° 500 / à¸„à¸·à¸™",
        swim_type: "salt",
      },
      travel: [
        {
          travel_loca_name: "HARBORLAND PATTAYA",
          travel_loca_url: "https://g.page/harborland-pattaya?share",
          travel_zone_name: "à¸žà¸±à¸—à¸¢à¸²à¸à¸¥à¸²à¸‡",
        },
      ],
      member_service: {
        bank_no: "should-not-leak",
      },
    });

    expect(content.facts).toMatchObject([
      { value: "14:00" },
      { value: "12:00" },
      { value: "25 คน" },
      { value: "฿5,000" },
      { value: "฿500 / คน" },
    ]);
    expect(content.location).toMatchObject({
      mapUrl: null,
    });
    expect(content.location?.seaDistance).toContain("8.5");
    expect(content.amenities).toEqual([
      { key: "wifi", label: "Wi-Fi" },
      { key: "karaoke", label: "คาราโอเกะ" },
      { key: "private_pool", label: "สระว่ายน้ำส่วนตัว" },
      { key: "extra_bed", label: "เตียงเสริม" },
      { key: "pet", label: "นำสัตว์เลี้ยงได้" },
    ]);
    expect(content.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "รายละเอียดห้องนอน",
        "สระว่ายน้ำ",
        "ครัวและอุปกรณ์",
        "ค่าใช้จ่ายเพิ่มเติม",
      ]),
    );
    expect(
      content.sections.find((section) => section.title === "รายละเอียดห้องนอน")?.lines[0],
    ).toContain("1:");
    expect(
      content.sections.find((section) => section.title === "สระว่ายน้ำ")?.lines,
    ).toContain("สระระบบเกลือ");
    expect(
      content.sections.find((section) => section.title === "ครัวและอุปกรณ์")?.lines.length,
    ).toBe(2);
    expect(
      content.sections.find((section) => section.title === "ค่าใช้จ่ายเพิ่มเติม")?.lines.length,
    ).toBe(2);
    expect(content.nearbyPlaces).toHaveLength(1);
    expect(content.nearbyPlaces[0]).toMatchObject({
      name: "HARBORLAND PATTAYA",
      url: "https://g.page/harborland-pattaya?share",
    });
    expect(content.videos).toEqual([
      {
        url: "https://youtu.be/dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        label: "คลิปรีวิวบ้านพัก 1",
      },
      {
        url: "https://example.com/review-video",
        embedUrl: null,
        thumbnailUrl: null,
        watchUrl: "https://example.com/review-video",
        label: "คลิปรีวิวบ้านพัก 2",
      },
    ]);
    expect(JSON.stringify(content)).not.toContain("should-not-leak");
  });

  it("returns empty content for unavailable details", () => {
    expect(buildVillaDetailContent(null)).toEqual({
      amenities: [],
      facts: [],
      location: null,
      nearbyPlaces: [],
      sections: [],
      videos: [],
    });
  });

  it("normalizes video URLs without trailing prose punctuation", () => {
    const content = buildVillaDetailContent({
      h_videos:
        "à¸£à¸µà¸§à¸´à¸§à¸šà¹‰à¸²à¸™à¸žà¸±à¸ (https://youtu.be/dQw4w9WgXcQ), https://example.com/review-video.",
    });

    expect(content.videos).toEqual([
      expect.objectContaining({
        url: "https://youtu.be/dQw4w9WgXcQ",
      }),
      expect.objectContaining({
        url: "https://example.com/review-video",
      }),
    ]);
  });
});
