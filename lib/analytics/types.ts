export type ContactChannel = "phone" | "chat" | "line";
export interface AnalyticsEventInput {
  schema_version: 1;
  event_id: string;
  event_name: "page_view" | "contact_click" | "gallery_open";
  channel: ContactChannel | null;
  villa_id: string | null;
  page_path: string;
}
export type TrackInput = Omit<
  AnalyticsEventInput,
  "schema_version" | "event_id"
>;
interface AnalyticsReportFields {
  from_date: string;
  to_date: string;
  timezone: "Asia/Bangkok";
  as_of: string;
  villa_id: string | null;
}
export interface AnalyticsDailyReportQuery extends AnalyticsReportFields { contract_version: "1.0" }
export interface AnalyticsHourlyReportQuery extends AnalyticsReportFields {
  contract_version: "1.1";
  granularity: "hour";
  from_time: string;
  to_time: string;
}
export type AnalyticsReportQuery = AnalyticsDailyReportQuery | AnalyticsHourlyReportQuery;
export class AnalyticsError extends Error {
  constructor(
    public code: string,
    public status = 422,
  ) {
    super(code);
  }
}
