# Staging Workers.dev Booking Calendar Host Design

## Goal

Allow the private booking-calendar API to run on the configured staging
`workers.dev` hostname without weakening the existing production hostname
boundary.

## Current Behavior

`getBookingCalendarAccessDecision` accepts a configured site URL only when its
hostname starts with `www.`. It then permits that exact hostname and its one
apex counterpart. The staging site instead uses the exact Worker hostname:

`baan-pool-villa-staging.chaymanus2003.workers.dev`

The staging request therefore fails closed with `503 Booking calendar access is
unavailable` before Bearer authentication or rate limiting.

## Approved Approach

Keep the existing `www.` production rule unchanged. Add a separate rule for a
configured hostname that is a direct Worker hostname under `workers.dev`:

- The configured URL must still use HTTPS.
- A `workers.dev` configuration may contain exactly one label before the
  account subdomain, matching the normal `<worker>.<account>.workers.dev`
  structure.
- Only the exact configured hostname is accepted.
- No apex counterpart, sibling Worker, additional subdomain, HTTP URL, or
  malformed configuration is accepted.
- Non-calendar routes retain their current behavior.

This exception is based on the configured hostname, not on a general
development-mode flag, so the Worker still fails closed when configuration is
missing or incorrect.

## Data Flow

1. The Worker classifies an exact booking-calendar route.
2. It parses `NEXT_PUBLIC_SITE_URL`.
3. For a normal `www.` host, it applies the existing exact-host plus apex rule.
4. For a valid direct `workers.dev` host, it allows only an exact hostname
   match.
5. After the host check passes, the existing Bearer validation and rate limit
   execute unchanged.
6. The existing Next route validates input and calls the Pattaya booking API.

## Tests

Add focused tests in `worker-cache-policy.test.ts` that prove:

- the exact configured staging Worker hostname is allowed;
- a sibling Worker hostname is rejected;
- an extra subdomain is rejected;
- HTTP is rejected;
- malformed or overly broad `workers.dev` configurations fail closed;
- existing `www.` and apex behavior remains unchanged.

Run only the affected Worker tests before deployment:

```powershell
npm.cmd test -- worker-cache-policy.test.ts worker-calendar-access.test.ts
```

After deploying staging, verify:

- no Bearer token returns `401`;
- the newly rotated Bearer token returns `200`;
- a non-matching hostname remains rejected.

## Out of Scope

- Production hostname or domain changes.
- Changes to token generation, token storage, booking normalization, cache
  policy, or rate-limit values.
- Production deployment or production secret rotation.
