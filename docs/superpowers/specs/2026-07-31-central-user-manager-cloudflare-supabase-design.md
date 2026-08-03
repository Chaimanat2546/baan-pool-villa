# Central User Manager Cloudflare–Supabase Request Fix

## Goal

Restore Central User Manager health checks and operations on the
`baan-pool-villa-staging` Cloudflare Worker while retaining the current
Supabase `sb_secret_` key and existing Bearer-authenticated Agent API.

## Evidence

- The configured Supabase secret succeeds against
  `central_user_manager_health_probe_v1` from a backend request.
- The health RPC reports that the database, `admin_users`, and operation tables
  are ready.
- The same key is rejected when the request presents browser-like request
  metadata.
- The Central User Manager target converts this upstream failure into its
  expected safe `503 provider_failure` response.

## Design

`createCentralUserManagerAdminClient` remains the single owner of the
privileged Supabase client. It will add an explicit, stable backend
`User-Agent` header to every request made by this client. Existing Supabase
authentication headers, non-persistent Auth configuration, Agent Bearer
authentication, operation fencing, and error projection remain unchanged.

The change is deliberately limited to the Central User Manager client so that
public and browser Supabase clients are unaffected.

## Verification

1. Add a focused test that captures the options passed to `createClient` and
   requires the backend `User-Agent`.
2. Run the focused client test and the existing Central User Manager health
   and production-context tests.
3. Run the narrow Central User Manager TypeScript configuration.
4. Deploy only the staging Worker.
5. Verify the central staging health endpoint and a read-only list operation.

## Rollback

Revert the client-factory change and redeploy the previous staging Worker
version. No database or credential rollback is required.
