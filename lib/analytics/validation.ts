import {
  AnalyticsError,
  type AnalyticsEventInput,
  type AnalyticsReportQuery,
} from "./types";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isCanonicalVillaId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d{0,15}$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}
export function isPublicAnalyticsPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    /[?#\\\s\u0000-\u001f]/u.test(value)
  )
    return false;
  if (["/", "/search", "/guides", "/terms", "/privacy"].includes(value))
    return true;
  if (value.startsWith("/villas/")) return isCanonicalVillaId(value.slice(8));
  return /^\/guides\/[a-zA-Z0-9%_-]+$/.test(value);
}
// Keep free-form article slugs out of analytics, including direct API submissions.
export function normalizeAnalyticsPath(value: unknown): string | null {
  if (typeof value === "string" && /^\/guides\/[a-zA-Z0-9%_-]+$/.test(value))
    return "/guides";
  if (!isPublicAnalyticsPath(value)) return null;
  return value;
}
function object(
  value: unknown,
  fields: string[],
  code: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !fields.includes(k)) ||
    fields.some((k) => !Object.hasOwn(value, k))
  )
    throw new AnalyticsError(code);
  return value as Record<string, unknown>;
}
export function validateAnalyticsEvent(value: unknown): AnalyticsEventInput {
  const v = object(
    value,
    [
      "schema_version",
      "event_id",
      "event_name",
      "channel",
      "villa_id",
      "page_path",
    ],
    "INVALID_EVENT",
  );
  if (
    v.schema_version !== 1 ||
    typeof v.event_id !== "string" ||
    !UUID.test(v.event_id) ||
    typeof v.page_path !== "string" ||
    normalizeAnalyticsPath(v.page_path) === null ||
    (v.villa_id !== null && !isCanonicalVillaId(v.villa_id))
  )
    throw new AnalyticsError("INVALID_EVENT");
  if (v.event_name === "contact_click") {
    if (!["phone", "chat", "line"].includes(v.channel as string))
      throw new AnalyticsError("INVALID_EVENT");
  } else if (v.event_name === "page_view" || v.event_name === "gallery_open") {
    if (
      v.channel !== null ||
      (v.event_name === "gallery_open" && v.villa_id === null)
    )
      throw new AnalyticsError("INVALID_EVENT");
  } else throw new AnalyticsError("INVALID_EVENT");
  if (v.event_name === "page_view") {
    const expected = v.page_path.startsWith("/villas/")
      ? v.page_path.slice(8)
      : null;
    if (v.villa_id !== expected) throw new AnalyticsError("INVALID_EVENT");
  }
  return {
    ...v,
    page_path: normalizeAnalyticsPath(v.page_path),
  } as unknown as AnalyticsEventInput;
}
function day(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AnalyticsError("INVALID_RANGE");
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new AnalyticsError("INVALID_RANGE");
  return time;
}
export function validateReportQuery(
  value: unknown,
  now = new Date(),
): { query: AnalyticsReportQuery; start: string; end: string } {
  const v = object(
    value,
    [
      "contract_version",
      "from_date",
      "to_date",
      "timezone",
      "as_of",
      "villa_id",
    ],
    "INVALID_QUERY",
  );
  if (v.contract_version !== "1.0")
    throw new AnalyticsError("UNSUPPORTED_CONTRACT");
  if (
    v.timezone !== "Asia/Bangkok" ||
    (v.villa_id !== null && !isCanonicalVillaId(v.villa_id))
  )
    throw new AnalyticsError("INVALID_QUERY");
  if (
    typeof v.as_of !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v.as_of)
  )
    throw new AnalyticsError("INVALID_RANGE");
  const asOf = Date.parse(v.as_of);
  if (
    !Number.isFinite(asOf) ||
    new Date(asOf).toISOString().slice(0, 19) !== v.as_of.slice(0, 19)
  )
    throw new AnalyticsError("INVALID_RANGE");
  const from = day(v.from_date),
    to = day(v.to_date);
  if (
    !Number.isFinite(asOf) ||
    asOf > now.getTime() + 300000 ||
    to < from ||
    (to - from) / 86400000 >= 92 ||
    to > day(new Date(asOf + 7 * 3600000).toISOString().slice(0, 10))
  )
    throw new AnalyticsError("INVALID_RANGE");
  return {
    query: v as unknown as AnalyticsReportQuery,
    start: new Date(from - 7 * 3600000).toISOString(),
    end: new Date(Math.min(to + 17 * 3600000, asOf)).toISOString(),
  };
}
