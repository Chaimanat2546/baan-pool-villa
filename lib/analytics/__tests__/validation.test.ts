import { expect, it } from "vitest";
import { validateAnalyticsEvent, validateReportQuery } from "../validation";
const event = {
  schema_version: 1,
  event_id: "11111111-1111-4111-8111-111111111111",
  event_name: "contact_click",
  channel: "line",
  villa_id: "66",
  page_path: "/villas/66",
};
it("accepts canonical event without changing payload", () =>
  expect(validateAnalyticsEvent(event)).toEqual(event));
it.each([
  { site_id: "forged" },
  { occurred_at: "2026-01-01" },
  { channel: "email" },
  { page_path: "/search?q=secret" },
  { page_path: "/admin" },
  { villa_id: "not-a-property-id" },
  { event_name: "gallery_open", villa_id: null, channel: null },
])("rejects invalid input %j", (extra) =>
  expect(() => validateAnalyticsEvent({ ...event, ...extra })).toThrow(),
);
it("keeps LINE distinct from chat and page views channel-free", () => {
  expect(() =>
    validateAnalyticsEvent({ ...event, event_name: "page_view" }),
  ).toThrow();
  expect(
    validateAnalyticsEvent({
      ...event,
      event_name: "page_view",
      channel: null,
    }),
  ).toMatchObject({ channel: null });
});
const query = {
  contract_version: "1.0",
  from_date: "2026-10-01",
  to_date: "2026-10-01",
  timezone: "Asia/Bangkok",
  as_of: "2026-10-02T00:00:00Z",
  villa_id: null,
};
it("rejects a rollover date in as_of", () => {
  expect(() =>
    validateReportQuery(
      {
        ...query,
        from_date: "2026-02-01",
        to_date: "2026-02-01",
        as_of: "2026-02-30T00:00:00Z",
      },
      new Date("2026-10-02"),
    ),
  ).toThrow();
});
it("maps a Thai day to half-open UTC bounds", () => {
  expect(
    validateReportQuery(query, new Date("2026-10-02T00:00:00Z")),
  ).toMatchObject({
    start: "2026-09-30T17:00:00.000Z",
    end: "2026-10-01T17:00:00.000Z",
  });
});
it.each([
  { from_date: "2026-02-30" },
  { from_date: "2026-01-01" },
  { timezone: "UTC" },
  { as_of: "2030-01-01T00:00:00Z" },
  { contract_version: "2.0" },
])("rejects invalid report %j", (extra) =>
  expect(() =>
    validateReportQuery(
      { ...query, ...extra },
      new Date("2026-10-02T00:00:00Z"),
    ),
  ).toThrow(),
);

it("discards guide slug before persistence", () => {
  expect(
    validateAnalyticsEvent({ ...event, page_path: "/guides/private-slug" })
      .page_path,
  ).toBe("/guides");
});
it("normalizes long encoded Thai guide slugs before the stored-path limit", () => {
  expect(validateAnalyticsEvent({ ...event, page_path: `/guides/${encodeURIComponent("ก".repeat(60))}` }).page_path).toBe("/guides");
});
