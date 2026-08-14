# Footer Facebook Page Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact Facebook follow button beside the Footer brand information that always opens a Facebook Page.

**Architecture:** Keep the existing contact configuration as the only input. In `SiteFooter`, resolve a safe Facebook Page URL from either an existing Facebook URL or a configured `m.me/<page>` URL; the new button and existing timeline embed reuse that resolved value, while the timeline remains controlled by its existing visibility setting.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, `react-icons`.

## Global Constraints

- Use `IoLogoFacebook` from `react-icons/io`; do not add a dependency.
- The button label is exactly `ติดตามเพจ`, uses Facebook blue `#1877F2`, and opens the destination in a new tab with `rel="noreferrer"`.
- Convert only a valid HTTPS `m.me/<page>` URL with exactly one path segment to `https://www.facebook.com/<page>`.
- Keep invalid URLs and root-only Facebook URLs from rendering the button.
- Preserve the existing Facebook timeline visibility switch and current footer navigation request budget.
- Do not commit unless the user explicitly asks.

---

### Task 1: Render a safe Facebook Page follow button in `SiteFooter`

**Files:**
- Modify: `components/layout/site-footer.tsx:1-201`
- Modify: `components/layout/__tests__/site-footer.test.tsx:1-190`

**Interfaces:**
- Consumes: `contactSettings.contact.messengerUrl: string` from `SiteContactSettings`.
- Produces: an optional anchor with `aria-label="ติดตามเพจ Facebook"`, `href` set to a valid Facebook Page URL, `target="_blank"`, and `rel="noreferrer"`.
- Reuses: the resolved Facebook Page URL to construct `FacebookPageTimeline` only when `contactSettings.contact.showFacebookTimeline` is true.

- [x] **Step 1: Write the failing footer rendering tests**

  Add these cases to `components/layout/__tests__/site-footer.test.tsx`:

  ```tsx
  it("renders a Facebook Page follow button beside the brand", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter contactSettings={DEFAULT_SITE_CONTACT_SETTINGS} settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain('aria-label="ติดตามเพจ Facebook"');
    expect(markup).toContain('href="https://www.facebook.com/baanpoolvillas"');
    expect(markup).toContain("ติดตามเพจ");
    expect(markup).toContain("io-logo-facebook");
  });

  it("converts an m.me contact URL for the Facebook Page follow button", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter
        contactSettings={{
          ...DEFAULT_SITE_CONTACT_SETTINGS,
          contact: { ...DEFAULT_SITE_CONTACT_SETTINGS.contact, messengerUrl: "https://m.me/baanpoolvillas" },
        }}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain('href="https://www.facebook.com/baanpoolvillas"');
    expect(markup).not.toContain('href="https://m.me/baanpoolvillas"');
  });

  it("hides the Facebook Page follow button for an invalid destination", () => {
    const markup = renderToStaticMarkup(
      <SiteFooter
        contactSettings={{
          ...DEFAULT_SITE_CONTACT_SETTINGS,
          contact: { ...DEFAULT_SITE_CONTACT_SETTINGS.contact, messengerUrl: "https://example.com/page" },
        }}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).not.toContain('aria-label="ติดตามเพจ Facebook"');
  });
  ```

- [x] **Step 2: Run the focused tests and verify the new assertions fail**

  Run: `npm.cmd test -- components/layout/__tests__/site-footer.test.tsx`

  Expected: FAIL because the follow-button anchor does not exist yet.

- [x] **Step 3: Implement the minimal safe URL resolver and button**

  In `components/layout/site-footer.tsx`:

  ```tsx
  import { IoLogoFacebook } from "react-icons/io";

  function resolveFacebookPageUrl(value: string) {
    try {
      const url = new URL(value);
      const pathParts = url.pathname.split("/").filter(Boolean);

      if (["facebook.com", "www.facebook.com"].includes(url.hostname) && pathParts.length > 0) {
        return url;
      }

      if (url.protocol === "https:" && url.hostname === "m.me" && pathParts.length === 1) {
        return new URL(`https://www.facebook.com/${encodeURIComponent(pathParts[0])}`);
      }
    } catch {
      // Invalid admin-provided contact links do not render public actions.
    }

    return null;
  }
  ```

  Resolve it once at the start of `SiteFooter`; use it for both the optional timeline plugin source and this anchor inside the desktop brand row:

  ```tsx
  {facebookPageUrl ? (
    <a
      aria-label="ติดตามเพจ Facebook"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-[#1877F2] px-2 py-1 text-sm font-semibold text-white transition hover:bg-[#166FE5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--site-primary)]"
      href={facebookPageUrl.toString()}
      rel="noreferrer"
      target="_blank"
    >
      <IoLogoFacebook aria-hidden="true" className="size-4" />
      <span>ติดตามเพจ</span>
    </a>
  ) : null}
  ```

  Keep the logo and brand-copy area responsive by making its wrapper stack on small screens and align its button to the right at the `sm` breakpoint.

- [x] **Step 4: Run the focused tests and verify they pass**

  Run: `npm.cmd test -- components/layout/__tests__/site-footer.test.tsx`

  Expected: PASS with all footer tests green.

- [ ] **Step 5: Run required verification**

  Run: `npm.cmd run lint`

  Expected: PASS with no ESLint errors.

  Run: `npm.cmd run build`

  Expected: PASS with the Next.js production build completing successfully.

  Run the local public page, inspect the Footer at desktop and mobile widths, and confirm the button opens `facebook.com/<page>` without client-side navigation.
