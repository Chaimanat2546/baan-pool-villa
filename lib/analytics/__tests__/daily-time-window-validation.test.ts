import { expect, it } from "vitest";
import { validateReportQuery } from "../validation";

const query = { contract_version: "1.2", granularity: "day", from_date: "2026-10-14", to_date: "2026-10-16", from_time: "09:00", to_time: "18:00", timezone: "Asia/Bangkok", as_of: "2026-10-17T00:00:00.000Z", villa_id: null };
const now = new Date(query.as_of);
it("accepts recurring daily windows with an outer UTC envelope", () => {
  expect(validateReportQuery(query, now)).toEqual({ query, start: "2026-10-14T02:00:00.000Z", end: "2026-10-16T11:00:00.000Z" });
  expect(validateReportQuery({ ...query, from_date: query.to_date, from_time: "23:00", to_time: "24:00" }, now).end).toBe("2026-10-16T17:00:00.000Z");
  expect(validateReportQuery({ ...query, as_of: "2026-10-16T04:30:00.000Z" }, now).end).toBe("2026-10-16T04:30:00.000Z");
  expect(validateReportQuery({ ...query, from_date: "2026-07-17" }, now).query.contract_version).toBe("1.2");
});
it.each([{ from_date: "2026-07-16" }, { granularity: "hour" }, { from_time: "09:30" }, { from_time: "24:00" }, { to_time: "09:00" }, { to_time: "08:00" }, { to_time: "24:01" }, { from_time: undefined }, { site_id: "forged" }, { timezone: "UTC" }, { as_of: "2026-10-18T00:00:00Z" }])("rejects invalid daily windows %j", extra => {
  expect(() => validateReportQuery({ ...query, ...extra }, now)).toThrow();
});
