# Footer Facebook Page Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins set a Facebook Page name that replaces the Footer site name, and show the page follow button only when the Facebook Timeline plugin is disabled.

**Architecture:** Extend the existing `site_contact_settings` contract with one optional `facebookPageName` field; all public and admin consumers receive it through the existing cached settings loader and admin PATCH route. `SiteFooter` remains responsible for the conditional layout, using its existing Facebook Page URL resolver and no new API integration.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase SQL migrations, Vitest, `react-icons`.

## Global Constraints

- Label: `ชื่อเพจ Facebook`.
- Description: `ใช้แสดงแทนชื่อเว็บไซต์ใน Footer; เมื่อปิด Facebook Timeline จะแสดงปุ่มติดตามเพจ`.
- An empty page name falls back to `settings.siteName`; names are trimmed and must be at most 120 characters.
- `showFacebookTimeline=true` shows the Timeline and no follow button; `false` hides the Timeline and shows the button only for a valid Facebook Page URL.
- Desktop layout is logo spanning two rows, page name plus optional button on row one, and bank information across row two.
- Long page names must use one-line CSS truncation.
- Follow existing 12-hour cached `site_contact_settings` reads and targeted contact-settings revalidation.
- Do not commit unless the user explicitly asks.

---

### Task 1: Persist and validate the Facebook Page name in contact settings

**Files:**
- Create: `supabase/migrations/20260814130000_add_facebook_page_name_to_site_contact_settings.sql`
- Modify: `supabase/site-settings-migrations/home-config-fresh-install.sql`
- Modify: `lib/site-contact-settings/types.ts`
- Modify: `lib/site-contact-settings/defaults.ts`
- Modify: `lib/site-contact-settings/validation.ts`
- Modify: `lib/site-contact-settings/server.ts`
- Modify: `lib/site-contact-settings/admin-route.ts`
- Test: `lib/site-contact-settings/__tests__/validation.test.ts`
- Test: `lib/site-contact-settings/__tests__/server.test.ts`
- Test: `lib/site-contact-settings/__tests__/admin-route.test.ts`

**Interfaces:**
- Produces: `SiteContactChannels.facebookPageName: string` and `SiteContactSettingsDraft.facebookPageName: string`.
- Persists: nullable `site_contact_settings.facebook_page_name`.
- Fallback: `normalizeSiteContactSettingsRow` returns `""` for missing, old, or whitespace-only values.

- [ ] **Step 1: Write failing contract tests**

  Extend row fixtures with `facebook_page_name: " พี่หมี พูลวิลล่าพัทยา "` and assert normalization and GET responses return `"พี่หมี พูลวิลล่าพัทยา"`. Add validation tests:

  ```ts
  expect(
    validateSiteContactSettingsDraft({
      ...validDraft,
      facebookPageName: "x".repeat(121),
    }),
  ).toContain("ชื่อเพจ Facebook ต้องมีความยาวไม่เกิน 120 ตัวอักษร");

  expect(
    normalizeSiteContactSettingsRow({ ...validRow, facebook_page_name: "   " }),
  ).toMatchObject({ contact: { facebookPageName: "" } });
  ```

  In the admin-route test, assert the upsert payload includes `facebook_page_name: "พี่หมี พูลวิลล่าพัทยา"`.

- [ ] **Step 2: Run focused contract tests and verify they fail**

  Run: `npm.cmd test -- lib/site-contact-settings/__tests__/validation.test.ts lib/site-contact-settings/__tests__/server.test.ts lib/site-contact-settings/__tests__/admin-route.test.ts`

  Expected: FAIL because the types, normalization, select projection, and persistence payload do not yet include `facebookPageName`.

- [ ] **Step 3: Add the migration and minimal contract implementation**

  Create an idempotent migration:

  ```sql
  alter table public.site_contact_settings
    add column if not exists facebook_page_name text;

  notify pgrst, 'reload schema';
  ```

  Add the same idempotent block to the fresh-install SQL bundle. Add `facebook_page_name` to both server and admin query projections. Thread `facebookPageName` through defaults, row normalization, draft normalization, PATCH validation, and the upsert object; use `null` for a blank persisted value.

- [ ] **Step 4: Run focused contract tests and verify they pass**

  Run: `npm.cmd test -- lib/site-contact-settings/__tests__/validation.test.ts lib/site-contact-settings/__tests__/server.test.ts lib/site-contact-settings/__tests__/admin-route.test.ts`

  Expected: PASS with all selected tests green.

### Task 2: Add the Contact Settings admin control

**Files:**
- Modify: `components/admin/settings/types.ts`
- Modify: `components/admin/settings/settings-helpers.ts`
- Modify: `components/admin/settings/settings-validation.ts`
- Modify: `components/admin/settings/contact-settings-page.tsx`
- Test: `components/admin/settings/__tests__/contact-settings-page.test.tsx`

**Interfaces:**
- Consumes: `ContactSettingsDraft.facebookPageName: string` from Task 1.
- Produces: JSON admin PATCH payload containing `facebookPageName`.

- [ ] **Step 1: Write the failing admin form test**

  Add a test that renders `ContactSettingsPage`, finds `#facebookPageName`, changes it to `พี่หมี พูลวิลล่าพัทยา`, saves, and asserts the request body parses to:

  ```ts
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
    facebookPageName: "พี่หมี พูลวิลล่าพัทยา",
  });
  expect(page.getByText("ใช้แสดงแทนชื่อเว็บไซต์ใน Footer; เมื่อปิด Facebook Timeline จะแสดงปุ่มติดตามเพจ")).toBeTruthy();
  ```

- [ ] **Step 2: Run the focused admin form test and verify it fails**

  Run: `npm.cmd test -- components/admin/settings/__tests__/contact-settings-page.test.tsx`

  Expected: FAIL because the control and the draft field do not exist.

- [ ] **Step 3: Implement the admin form wiring**

  Add `facebookPageName` to `ContactSettingsDraft`, `mapContactSettingsResponse`, snapshot creation, request JSON construction, and `validateContactSettingsDraft`. In the social card, render a `TextControl` with `id="facebookPageName"`, the required label/description, `maxLength={120}`, and `state.updateDraft({ facebookPageName })`.

- [ ] **Step 4: Run the focused admin form test and verify it passes**

  Run: `npm.cmd test -- components/admin/settings/__tests__/contact-settings-page.test.tsx`

  Expected: PASS.

### Task 3: Render the conditional Footer layout

**Files:**
- Modify: `components/layout/site-footer.tsx`
- Modify: `components/layout/__tests__/site-footer.test.tsx`

**Interfaces:**
- Consumes: `contactSettings.contact.facebookPageName` and `contactSettings.contact.showFacebookTimeline`.
- Produces: the Footer title, Timeline, and optional follow button described in the global constraints.

- [ ] **Step 1: Write failing Footer behaviour and layout tests**

  Add tests for these public outcomes:

  ```tsx
  expect(pluginOnMarkup).toContain("พี่หมี พูลวิลล่าพัทยา");
  expect(pluginOnMarkup).not.toContain('aria-label="ติดตามเพจ Facebook"');
  expect(pluginOnMarkup).toContain('title="โพสต์ล่าสุดจาก Facebook"');

  expect(pluginOffMarkup).toContain("พี่หมี พูลวิลล่าพัทยา");
  expect(pluginOffMarkup).toContain('aria-label="ติดตามเพจ Facebook"');
  expect(pluginOffMarkup).not.toContain('title="โพสต์ล่าสุดจาก Facebook"');

  expect(longNameMarkup).toContain("truncate");
  expect(longNameMarkup).toContain(DEFAULT_SITE_CONTACT_SETTINGS.bank.accountNumber);
  ```

- [ ] **Step 2: Run the Footer test and verify it fails**

  Run: `npm.cmd test -- components/layout/__tests__/site-footer.test.tsx`

  Expected: FAIL because the Footer always shows `settings.siteName` and currently renders the button independently of the Timeline state.

- [ ] **Step 3: Implement the two-row desktop grid and conditional button**

  Resolve the title with:

  ```ts
  const footerTitle = contactSettings.contact.facebookPageName || settings.siteName;
  const shouldShowFollowButton =
    !contactSettings.contact.showFacebookTimeline && facebookPageUrl;
  ```

  Replace the current flexible brand block with a desktop grid whose logo uses `row-span-2`, title uses `min-w-0 truncate`, button remains in the top-right cell, and bank copy uses the full second-row width. Keep mobile as a stacked layout. Use `shouldShowFollowButton` for the anchor and leave the timeline visibility condition unchanged.

- [ ] **Step 4: Run the Footer test and verify it passes**

  Run: `npm.cmd test -- components/layout/__tests__/site-footer.test.tsx`

  Expected: PASS.

### Task 4: Document the contact-settings contract and verify the change

**Files:**
- Modify: `docs/ai/structure.html`
- Modify: `docs/superpowers/specs/2026-08-14-footer-facebook-page-button-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-footer-facebook-page-name.md`

**Interfaces:**
- Documents: the `facebookPageName` contact setting, Footer fallback, and Timeline-dependent follow-button visibility.

- [ ] **Step 1: Update the structure map**

  Amend the contact-settings ownership entry to state that `facebookPageName` is public Footer display data, falls back to `siteName`, and controls no API fetches.

- [ ] **Step 2: Run full verification**

  Run: `npm.cmd run lint`

  Expected: PASS with no errors.

  Run: `npm.cmd run build`

  Expected: PASS with the Next.js production build completing successfully.

  Start the local app and inspect the Footer in desktop and mobile viewports. Verify plugin-on has no button; plugin-off has the top-right button, an unbroken bank row, and a truncated long-name layout.
