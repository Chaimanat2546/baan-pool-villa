# Admin CMS Data Model Refactor Status

## Current State

`site_settings` is being reduced one bounded domain at a time. This document records the implemented ownership and the remaining release gates; it is not a proposal to redesign SEO or Web Styles again.

| Domain | Canonical storage | Status |
| --- | --- | --- |
| SEO | `site_seo_settings` | Implemented. Global, search, guides, and villa-detail SEO are owned by the dedicated SEO domain. |
| Web Styles | `site_web_styles` | Implemented. Header, gallery, and house-card styles are owned by the dedicated Web Styles domain. |
| Contact and public bank display | `site_contact_settings` | Final canonical owner. Expansion, application cutover, production verification, and contract completed on 2026-07-21. |
| Brand, theme, assets, TikTok, marketing tag, detail layout | `site_settings` | Still owned by `site_settings`; not part of the contact refactor. |

SEO and Web Styles must not be recreated as part of `site_contact_settings` work.

## Contact Target Model

`site_contact_settings` is a public-readable singleton table. It intentionally keeps the current product contract together instead of introducing child tables with no current caller.

Columns:

- `singleton_id boolean primary key default true` with a singleton check.
- `bank_account_name`, `bank_name`, and `bank_account_number`.
- `phone_contacts jsonb` containing the ordered public phone contacts.
- `messenger_url`, `line_id`, and `line_url`.
- `created_at` and `updated_at`.

Security and access:

- RLS is enabled.
- Anonymous and authenticated users may select the public contact row.
- Only authenticated admins may insert or update it.
- Delete is not granted.
- The expansion migration includes explicit table grants and a PostgREST schema reload.

The table contains public display data only. Internal payment or admin-only banking data must not be added without a separate product and security decision.

## Application Ownership

| Concern | Owner |
| --- | --- |
| Types and row contract | `lib/site-contact-settings/types.ts` |
| Production-safe defaults | `lib/site-contact-settings/defaults.ts` |
| Normalization and validation | `lib/site-contact-settings/validation.ts` |
| Cached public read | `lib/site-contact-settings/server.ts` |
| Admin GET/PATCH persistence | `lib/site-contact-settings/admin-route.ts` |
| Compatible admin endpoint | `app/(admin)/api/admin/site-settings/contact/route.ts` |
| Public link formatting | `lib/site-contact.ts` |
| Cache duration and tag | `lib/cache-policy.ts` and `lib/cache-revalidation.ts` |

`lib/site-settings` no longer owns the seven contact/bank fields. The other `/api/admin/site-settings/:section` routes do not accept `contact`; the compatible URL is handled by its dedicated route.

## Public Consumers

The public layout loads general settings, contact settings, and Web Styles independently. Header, footer, mobile contact actions, the shared contact section, homepage JSON-LD, guide/legal contact sections, and villa booking contact actions receive the contact domain explicitly.

Metadata still uses the existing SEO owner. `buildHomeJsonLd` receives both SEO/general settings and contact settings so the business phone does not leak back into `SiteSettings` ownership.

## Rollout

### 1. Expand — applied 2026-07-21

Migration: `supabase/migrations/20260720084701_create_site_contact_settings.sql`

It creates the table, policies, grants, one-time non-destructive backfill from `site_settings`, timestamp trigger, schema reload, and postflight checks. The backfill uses `on conflict do nothing`, so rerunning it cannot overwrite canonical contact values with legacy data.

The expansion and contract migrations are recorded with the same source-controlled versions in all three production projects: `zkxpozvhvmgqfrwnlfrn`, `vfqxpujsvgdqtrzpxobh`, and `lpxsktjrkjzwbxvhjogo`. Each project backfilled only from its own legacy row.

### 2. Deploy and verify — completed 2026-07-21

Production verification covered the public header, footer, homepage contact and JSON-LD, guide/legal pages, villa booking actions, and the Contact admin page. Desktop and a 390 px mobile viewport rendered without horizontal overflow; the mobile contact bar exposed the canonical phone, Messenger, and LINE links.

The production network check returned zero `_rsc` and zero `/_next/image` requests, with only the bounded `/api/site-theme.css` request. A same-value Contact save normalized `LINE ID` back to `@baanpool`, advanced only `site_contact_settings.updated_at`, and left `site_settings.updated_at` unchanged. Public and admin browser logs contained no errors.

The deployed application and repository scan contain no runtime read or write of the seven legacy columns outside the dedicated contact persistence owner and schema history.

The deployed application no longer has a legacy Contact read or write path.

### 3. Contract — completed 2026-07-21

Migration: `supabase/migrations/20260721093339_contract_site_contact_settings.sql`

Before application, the migration verified one canonical row, one legacy source row, all seven legacy columns, and exact equality across every value. A timestamped JSON export was taken outside Git with SHA-256 `D58B9BAB7451032D98E04DFEC7C9B543801D1253561A2EE49B8D276A79EEE657`, and the user explicitly approved the destructive contract step.

Postflight on all three production projects returned one canonical row and zero legacy columns. RLS remained enabled with all three required policies and no DELETE/TRUNCATE grant. Production public smoke tests loaded each environment's canonical bank/contact values without browser errors; authenticated Admin Contact loaded on `baanPMhee` and `baanparty`, while unauthenticated `baan02` redirected to login. Migration history versions match the source-controlled expansion and contract filenames everywhere.

Rollback after this point requires a forward migration that recreates the legacy schema and restores exported values; do not redeploy the old application by itself.

Dropped legacy columns:

- `bank_account_name`
- `bank_name`
- `bank_account_number`
- `phone_contacts`
- `messenger_url`
- `line_id`
- `line_url`

## Verification Contract

Focused tests must cover defaults, normalization, URL and phone validation, cached fallback behavior, admin authentication/parsing/upsert errors, cache revalidation, public contact link formatting, and all affected consumers.

Before declaring the application change deployable, run:

- Contact/site-settings/admin/public focused tests.
- `npm.cmd run lint`.
- `npm.cmd run build`.
- The browser checks listed in the deploy gate after a database with the expansion migration is available.

The contact contract is complete; the seven dropped columns must not be recreated outside an explicit forward recovery migration.
