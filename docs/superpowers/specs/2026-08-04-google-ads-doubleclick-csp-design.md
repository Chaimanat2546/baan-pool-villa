# Google Ads DoubleClick CSP Design

## Outcome

Allow the existing Google Tag Manager container to send the observed Google Ads collection and conversion requests without weakening unrelated Content Security Policy directives.

## Scope

- Add `https://ad.doubleclick.net`, `https://googleads.g.doubleclick.net`, and `https://www.google.co.th` as explicit `connect-src` origins in the shared CSP builder.
- Add `https://googleads.g.doubleclick.net` and the already-known Google collection origin `https://www.google.com` as explicit `img-src` origins for conversion pixel requests.
- Keep the allowlist origin-specific; do not add wildcards or other Google advertising domains.
- Add focused assertions covering both the CSP builder and the global Next.js security header.
- Do not change GTM configuration, consent behavior, scripts, frames, or other CSP directives.

## Implementation Ownership

`lib/security/csp.ts` remains the source of truth for the global Content Security Policy. The observed Google Ads origins will be represented by named constants and included only in the directives demonstrated by the browser errors. Existing CSP tests will verify the generated policy and the policy exposed through `next.config.ts`.

## Verification

Run the focused CSP and Next config tests, followed by lint and a production build. A deployed production browser check should confirm that the observed `ad.doubleclick.net/ccm/s/collect`, `googleads.g.doubleclick.net/pagead/viewthroughconversion`, `www.google.com/ccm/conversion`, and `www.google.co.th/pagead/1p-conversion` requests are no longer blocked and that no additional advertising origins are required.
