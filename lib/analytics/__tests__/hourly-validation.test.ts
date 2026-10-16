import { expect, it } from "vitest";
import { validateReportQuery } from "../validation";

const query = {
  contract_version: "1.1", granularity: "hour", from_date: "2026-10-15", to_date: "2026-10-15",
  from_time: "09:00", to_time: "18:00", timezone: "Asia/Bangkok",
  as_of: "2026-10-16T04:00:00.000Z", villa_id: null,
};
const now = new Date(query.as_of);
it("maps hourly Thai ranges to UTC without including the end boundary", () => {
  expect(validateReportQuery(query, now)).toMatchObject({ query, start: "2026-10-15T02:00:00.000Z", end: "2026-10-15T11:00:00.000Z" });
  expect(validateReportQuery({ ...query, from_time: "23:00", to_time: "24:00" }, now)).toMatchObject({ start: "2026-10-15T16:00:00.000Z", end: "2026-10-15T17:00:00.000Z" });
});
it("clips hourly data to snapshot and accepts not-yet-observed hours", () => {
  expect(validateReportQuery({ ...query, as_of: "2026-10-15T02:30:00.000Z" }, now).end).toBe("2026-10-15T02:30:00.000Z");
  expect(validateReportQuery({ ...query, as_of: "2026-10-15T01:00:00.000Z" }, now).end).toBe("2026-10-15T01:00:00.000Z");
});
it.each([
  { from_time: "24:00" }, { from_time: "9:00" }, { from_time: "09:30" },
  { to_time: "24:01" }, { to_time: "09:00" }, { to_time: "08:00" },
  { to_date: "2026-10-16" }, { from_time: undefined }, { site_id: "forged" },
  { contract_version: "1.0" }, { granularity: "day" },
])("rejects malformed hourly inputs %j", extra => {
  expect(() => validateReportQuery({ ...query, ...extra }, now)).toThrow();
});
