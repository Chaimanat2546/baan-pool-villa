import { describe, expect, it } from "vitest";
import { buildVillaDetailContent } from "../detail";

describe("buildVillaDetailContent", () => {
  it("extracts guest-facing facts, notes, and nearby places from the raw detail API", () => {
    const content = buildVillaDetailContent({
      h_time_checkin: "14:00:00",
      h_time_checkout: "12:00:00",
      h_extra: "500",
      h_insurance: "5000",
      location: "ตรงข้ามหาดพัทยากลาง",
      sea: "8.5 กม.",
      h_additional_costs: "-ไฟฟรี 100 หน่วย\r\nเกินหน่วยละ 7 บาท",
      h_kitchen_ware: "- ไมโครเวฟ\r\n- เครื่องครัวไทยครบ",
      h_moredetail: "-ห้องนอนมี TV ทุกห้อง",
      h_parking: "- จอดในบ้าน 13 คัน",
      h_swimmingpool: "- กว้าง 3.5 ม. ยาว 8 ม.",
      h_bedroom_detail: "ห้องนอนที่ 1: เตียง 6 ฟุต",
      h_people_max: "25",
      h_videos: "https://youtu.be/dQw4w9WgXcQ\nhttps://example.com/review-video",
      facilities: {
        swimming_pool: "y",
        pets: "y",
        pet_detail: "น้องหมาแมวไม่เกิน 5 กิโลกรัม ตัวละ 500 / คืน",
        swim_type: "salt",
      },
      travel: [
        {
          travel_loca_name: "HARBORLAND PATTAYA",
          travel_loca_url: "https://g.page/harborland-pattaya?share",
          travel_zone_name: "พัทยากลาง",
        },
      ],
      member_service: {
        bank_no: "should-not-leak",
      },
    });

    expect(content.facts).toEqual([
      { label: "เช็คอิน", value: "14:00" },
      { label: "เช็คเอาต์", value: "12:00" },
      { label: "พักได้สูงสุด", value: "25 คน" },
      { label: "ค่าประกัน", value: "฿5,000" },
      { label: "เสริมคน", value: "฿500 / คน" },
    ]);
    expect(content.location).toEqual({
      address: "ตรงข้ามหาดพัทยากลาง",
      seaDistance: "8.5 กม.",
      mapUrl: null,
    });
    expect(content.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "รายละเอียดห้องนอน",
          lines: ["ห้องนอนที่ 1: เตียง 6 ฟุต"],
        }),
        expect.objectContaining({
          title: "สระว่ายน้ำ",
          lines: ["กว้าง 3.5 ม. ยาว 8 ม.", "สระระบบเกลือ"],
        }),
        expect.objectContaining({
          title: "ครัวและอุปกรณ์",
          lines: ["ไมโครเวฟ", "เครื่องครัวไทยครบ"],
        }),
        expect.objectContaining({
          title: "ค่าใช้จ่ายเพิ่มเติม",
          lines: ["ไฟฟรี 100 หน่วย", "เกินหน่วยละ 7 บาท"],
        }),
      ]),
    );
    expect(content.nearbyPlaces).toEqual([
      {
        name: "HARBORLAND PATTAYA",
        zone: "พัทยากลาง",
        url: "https://g.page/harborland-pattaya?share",
      },
    ]);
    expect(content.videos).toEqual([
      {
        url: "https://youtu.be/dQw4w9WgXcQ",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        label: "คลิปรีวิวบ้านพัก 1",
      },
      {
        url: "https://example.com/review-video",
        embedUrl: null,
        watchUrl: "https://example.com/review-video",
        label: "คลิปรีวิวบ้านพัก 2",
      },
    ]);
    expect(JSON.stringify(content)).not.toContain("should-not-leak");
  });

  it("returns empty content for unavailable details", () => {
    expect(buildVillaDetailContent(null)).toEqual({
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
        "รีวิวบ้านพัก (https://youtu.be/dQw4w9WgXcQ), https://example.com/review-video.",
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
