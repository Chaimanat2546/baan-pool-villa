# Footer Facebook Page Name and Follow Button

## Goal

Let an admin enter a Facebook Page name. The public Footer uses it in place of the site name, and conditionally shows a follow-page button when the Facebook Timeline plugin is disabled.

## Admin Setting

- Add `facebookPageName` to the existing contact settings domain and persist it in `site_contact_settings`.
- Place the text field in the existing “ช่องทางแชตและโซเชียล” card.
- Use this label and explanation:
  - Label: `ชื่อเพจ Facebook`
  - Description: `ใช้แสดงแทนชื่อเว็บไซต์ใน Footer; เมื่อปิด Facebook Timeline จะแสดงปุ่มติดตามเพจ`
- The field may be blank. Public rendering then falls back to the resolved `settings.siteName`.
- Normalize whitespace and reject input longer than 120 characters.

## Public Footer Behaviour

- Always render the resolved Facebook Page name in the Footer title when the admin value is non-empty; otherwise use `settings.siteName`.
- Keep the existing validated Facebook Page URL resolution from `messengerUrl`, including the safe `m.me/<page>` to `facebook.com/<page>` conversion.
- When `showFacebookTimeline` is true:
  - Render the Facebook Timeline plugin as now.
  - Do not render the follow button.
- When `showFacebookTimeline` is false:
  - Do not render the plugin.
  - Render the Facebook-blue `IoLogoFacebook` button labelled `ติดตามเพจ`, only when a valid Facebook Page URL resolves.
- Opening the follow button uses a new tab and `rel="noreferrer"`.

## Desktop Layout

Use a three-column, two-row brand block:

```text
┌────────┬────────────────────┬──────┐
│        │ Facebook Page name │ Button│
│ Logo   ├────────────────────┴──────┤
│        │ Bank account information   │
└────────┴───────────────────────────┘
```

- The logo spans both rows.
- The name occupies the top-middle cell; it is a single line with CSS `truncate` so it cannot overlap the button.
- The button is the top-right cell only, not vertically merged into the bank-information row.
- The bank copy spans the remaining second-row width.
- On narrow screens, stack logo/name, bank information, and the optional button without horizontal overflow.

## Data and Cache Boundaries

- Use the existing 12-hour `site_contact_settings` cache and its existing targeted revalidation flow.
- Extend settings types, defaults, normalizers, query projections, admin route payloads, and contact settings drafts together.
- Add an idempotent migration in `supabase/migrations` plus the matching fresh-install SQL bundle update.
- Update `docs/ai/structure.html` because a public contact-settings contract gains a field.

## Tests and Verification

- Add focused tests for normalization/validation, admin persistence request and response mapping, and Footer plugin-on/plugin-off rendering.
- Verify that a long page name has a truncation class and does not remove the bank copy.
- Run focused tests, lint, production build, and inspect desktop/mobile Footer layouts locally.
