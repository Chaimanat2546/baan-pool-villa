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
export interface AnalyticsReportQuery {
  contract_version: "1.0";
  from_date: string;
  to_date: string;
  timezone: "Asia/Bangkok";
  as_of: string;
  villa_id: string | null;
}
export class AnalyticsError extends Error {
  constructor(
    public code: string,
    public status = 422,
  ) {
    super(code);
  }
}
