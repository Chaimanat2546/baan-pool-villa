# Staging Turnstile Configuration Design

## Outcome

Configure Cloudflare Turnstile for the `baan-pool-villa-staging` Worker using
the values already stored in `.env.staging`, without changing any production
Worker or production environment.

## Configuration flow

- Read `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from
  `.env.staging` without printing or persisting their values elsewhere.
- Upload `TURNSTILE_SECRET_KEY` to the staging Worker as a server-only secret
  through ASCII stdin so no BOM is introduced.
- Inject `NEXT_PUBLIC_TURNSTILE_SITE_KEY` into the staging build environment.
  Next.js freezes this public value into the browser bundle at build time, so a
  fresh OpenNext build is required.
- Deploy the newly built artifact only to the `staging` Wrangler environment.

## Verification

- Run the focused Turnstile unit and route tests.
- Confirm the staging admin login renders the Turnstile widget instead of the
  missing-configuration state.
- Confirm the verification route rejects a missing token without exposing
  provider details.
- Do not run unrelated tests and do not modify or deploy production.

## Security and rollback

- Never print either key or write them into tracked configuration.
- Keep the secret server-only; only the site key is exposed to the browser.
- If verification fails, stop before changing application logic. The previous
  staging Worker version remains available for rollback, but production is
  outside the rollback scope.
