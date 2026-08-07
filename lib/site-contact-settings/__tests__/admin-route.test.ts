import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateSiteContactSettingsCache } from "@/lib/cache-revalidation";
import {
  getAdminSiteContactSettings,
  saveAdminSiteContactSettings,
} from "../admin-route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteContactSettingsCache: vi.fn(),
}));

const revalidateMock = vi.mocked(revalidateSiteContactSettingsCache);
const savedRow = {
  singleton_id: true,
  bank_account_name: "Account Name",
  bank_name: "Bank Name",
  bank_account_number: "123-4-56789-0",
  phone_contacts: [
    { name: "Game", phone: "0617485213", time: "07.00-15.00" },
  ],
  messenger_url: "https://www.facebook.com/baanpoolvillas",
  show_facebook_timeline: true,
  line_id: "@baanpoolvilla",
  line_url: "https://line.me/R/ti/p/@baanpoolvilla",
};
const validDraft = {
  bankAccountName: " Account Name ",
  bankName: " Bank Name ",
  bankAccountNumber: " 123-4-56789-0 ",
  phoneContacts: [
    { name: " Game ", phone: " 0617485213 ", time: " 07.00-15.00 " },
  ],
  messengerUrl: " https://www.facebook.com/baanpoolvillas ",
  showFacebookTimeline: false,
  lineId: " @baanpoolvilla ",
  lineUrl: " https://line.me/R/ti/p/@baanpoolvilla ",
};

function client(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const selectAfterUpsert = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert });
  const from = vi.fn().mockReturnValue({ select, upsert });
  return { client: { from } as never, eq, from, maybeSingle, select, selectAfterUpsert, upsert };
}

describe("site contact settings admin route helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revalidateMock.mockResolvedValue(undefined);
  });

  it("loads only the dedicated singleton columns", async () => {
    const query = client({ data: savedRow, error: null });

    const response = await getAdminSiteContactSettings(query.client);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      section: "contact",
      settings: { bank: { accountName: "Account Name" } },
    });
    expect(query.from).toHaveBeenCalledWith("site_contact_settings");
    expect(query.select).toHaveBeenCalledWith(
      "singleton_id,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,show_facebook_timeline,line_id,line_url",
    );
    expect(query.eq).toHaveBeenCalledWith("singleton_id", true);
  });

  it.each([
    { ...validDraft, unexpected: true },
    { ...validDraft, phoneContacts: { phone: "0617485213" } },
    { ...validDraft, messengerUrl: "javascript:alert(1)" },
    {
      ...validDraft,
      phoneContacts: [{ name: "Game", phone: "123", time: "day" }],
    },
  ])("rejects invalid or extra JSON before persistence", async (body) => {
    const query = client({ data: savedRow, error: null });
    const request = new Request("https://example.com/api/admin/site-settings/contact", {
      body: JSON.stringify(body),
      method: "PATCH",
    });

    const response = await saveAdminSiteContactSettings(request, query.client);

    expect(response.status).toBe(400);
    expect(query.from).not.toHaveBeenCalled();
  });

  it("normalizes and upserts the singleton without writing site_settings", async () => {
    const query = client({ data: savedRow, error: null });
    const request = new Request("https://example.com/api/admin/site-settings/contact", {
      body: JSON.stringify(validDraft),
      method: "PATCH",
    });

    const response = await saveAdminSiteContactSettings(request, query.client);

    expect(response.status).toBe(200);
    expect(query.from).toHaveBeenCalledTimes(1);
    expect(query.from).toHaveBeenCalledWith("site_contact_settings");
    expect(query.upsert).toHaveBeenCalledWith(
      { ...savedRow, show_facebook_timeline: false, singleton_id: true },
      { onConflict: "singleton_id" },
    );
    expect(await response.json()).toMatchObject({
      section: "contact",
      settings: { bank: { accountName: "Account Name" } },
      verified: true,
      warnings: [],
    });
    expect(revalidateMock).toHaveBeenCalledTimes(1);
  });

  it("preserves structured database errors", async () => {
    const query = client({
      data: null,
      error: { code: "42501", details: "policy", hint: "admin only", message: "denied" },
    });

    const response = await getAdminSiteContactSettings(query.client);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "42501",
      details: "policy",
      error: "denied",
      hint: "admin only",
    });
  });

  it("returns the saved row with a warning when cache refresh fails", async () => {
    revalidateMock.mockRejectedValue(new Error("cache failed"));
    const query = client({ data: savedRow, error: null });
    const request = new Request("https://example.com/api/admin/site-settings/contact", {
      body: JSON.stringify(validDraft),
      method: "PATCH",
    });

    const response = await saveAdminSiteContactSettings(request, query.client);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      verified: true,
      warnings: ["Settings were saved but cache refresh failed."],
    });
  });
});
