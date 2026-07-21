import "server-only";

import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { revalidateSiteContactSettingsCache } from "@/lib/cache-revalidation";
import type { SiteContactSettingsDraft, SiteContactSettingsRow } from "./types";
import {
  normalizeSiteContactSettingsDraft,
  normalizeSiteContactSettingsRow,
  validateSiteContactSettingsDraft,
} from "./validation";

const SELECT =
  "singleton_id,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url";
const FIELDS = [
  "bankAccountName",
  "bankName",
  "bankAccountNumber",
  "phoneContacts",
  "messengerUrl",
  "lineId",
  "lineUrl",
] as const;

function invalid(errors = ["Invalid request body."]) {
  return Response.json({ errors }, { status: 400 });
}

function parseDraft(value: unknown): SiteContactSettingsDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !FIELDS.includes(key as (typeof FIELDS)[number])) ||
    FIELDS.some((field) => !(field in body)) ||
    typeof body.bankAccountName !== "string" ||
    typeof body.bankName !== "string" ||
    typeof body.bankAccountNumber !== "string" ||
    typeof body.messengerUrl !== "string" ||
    typeof body.lineId !== "string" ||
    typeof body.lineUrl !== "string" ||
    !Array.isArray(body.phoneContacts) ||
    body.phoneContacts.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof (item as Record<string, unknown>).name !== "string" ||
        typeof (item as Record<string, unknown>).phone !== "string" ||
        typeof (item as Record<string, unknown>).time !== "string",
    )
  ) {
    return null;
  }
  return body as unknown as SiteContactSettingsDraft;
}

export async function getAdminSiteContactSettings(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error } = await supabase
    .from("site_contact_settings")
    .select(SELECT)
    .eq("singleton_id", true)
    .maybeSingle();

  if (error || !data) {
    return adminSupabaseErrorResponse(
      error ?? { code: "PGRST116", message: "Site contact settings were not found." },
      "Unable to load site contact settings.",
    );
  }

  return Response.json({
    section: "contact",
    settings: normalizeSiteContactSettingsRow(data as SiteContactSettingsRow),
  });
}

export async function saveAdminSiteContactSettings(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }

  const parsed = parseDraft(body);
  if (!parsed) return invalid();

  const draft = normalizeSiteContactSettingsDraft(parsed);
  const errors = validateSiteContactSettingsDraft(draft);
  if (errors.length > 0) return invalid(errors);

  const payload = {
    singleton_id: true,
    bank_account_name: draft.bankAccountName,
    bank_name: draft.bankName,
    bank_account_number: draft.bankAccountNumber,
    phone_contacts: draft.phoneContacts,
    messenger_url: draft.messengerUrl,
    line_id: draft.lineId,
    line_url: draft.lineUrl,
  };
  const { data, error } = await supabase
    .from("site_contact_settings")
    .upsert(payload, { onConflict: "singleton_id" })
    .select(SELECT)
    .maybeSingle();

  if (error || !data) {
    return adminSupabaseErrorResponse(
      error ?? { code: "PGRST116", message: "Site contact settings were not found." },
      "Unable to save site contact settings.",
    );
  }

  const warnings: string[] = [];
  try {
    await revalidateSiteContactSettingsCache();
  } catch {
    warnings.push("Settings were saved but cache refresh failed.");
  }

  return Response.json({
    section: "contact",
    settings: normalizeSiteContactSettingsRow(data as SiteContactSettingsRow),
    verified: true,
    warnings,
  });
}
