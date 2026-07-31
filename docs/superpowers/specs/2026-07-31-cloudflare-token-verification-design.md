# Cloudflare API Token Verification Design

## Goal

Fail each production deployment target before build or deploy when its
Cloudflare API token is invalid, using Cloudflare's token-verification API.

## Scope

- Add a GitHub Actions step in the production deploy job after dependencies are
  installed and before target validation, build, and deployment.
- Call `GET https://api.cloudflare.com/client/v4/user/tokens/verify` with
  `Authorization: Bearer $CLOUDFLARE_API_TOKEN`.
- Treat a non-2xx response or an API response with `success: false` as a
  failure without printing the token or response body.
- Keep `CLOUDFLARE_API_TOKEN` scoped to the verification, validation, and
  deploy steps; do not add it at job scope or expose it to the build step.
- Update workflow tests and the deployment runbook.

## Design

Use a shell step with `curl --fail --silent --show-error` and pass the bearer
token only in an HTTP header. The endpoint's HTTP status is sufficient for the
workflow gate because Cloudflare returns an error status when verification
fails; response content is discarded to avoid leaking diagnostic data.

The workflow test will assert the named verification step, endpoint, Bearer
header, and ordering before the configuration validation step. The runbook will
state that the production CD validates the token before it builds or deploys.

## Error Handling and Security

- GitHub Actions masks secret values, but the command must not echo the header
  or API response.
- Network, authentication, and authorization errors stop only the affected
  matrix target before its build starts.
- Existing least-privilege Cloudflare token scopes remain unchanged.

## Verification

Run the focused Vitest workflow test, then the full test suite and ESLint.
This changes CI configuration and documentation only, so no Next.js build or
browser rendering is needed.
