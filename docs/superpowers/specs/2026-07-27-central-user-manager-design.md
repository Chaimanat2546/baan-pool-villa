# Central User Manager Design

**Date:** 2026-07-27  
**Status:** Confirmed design, pending written-spec review

## Goal

Build a Central User Manager inside `Chaimanat2546/webook` that lets trusted
`webook` Administrators manage the admin accounts of 20–100 independently
deployed `baan-pool-villa` customers.

Each customer has one Cloudflare Worker deployment and one Supabase project,
while each customer may have multiple admin users. Customers cannot create
admin users themselves. A central operator creates, suspends, reactivates, and
reissues temporary passwords for those users.

## Scope and Terminology

- **Control Plane:** The Central User Manager UI and server-side orchestration
  in `webook`.
- **Customer Project / Tenant:** One operator business, one
  `baan-pool-villa` deployment, and one Supabase project.
- **Tenant Agent:** A narrow internal API deployed as part of each
  `baan-pool-villa` Worker.
- **Target Admin:** A user represented by both Supabase `auth.users` and
  `public.admin_users` in a customer project.
- **Central Administrator:** A `webook` user whose `public.users.role_id` is
  the `Administrator` role.

The first release manages only `baan-pool-villa` target admins. It does not
manage `webook` users or general members inside customer applications.

## Confirmed Product Decisions

- The expected scale is 20–100 customer projects.
- All Cloudflare Workers and Supabase projects remain under accounts controlled
  by the platform owner.
- `webook` is the UI and Control Plane; each target Supabase project remains
  the source of truth for its admin users.
- A customer project stores only the admin email as profile information.
- Email uniqueness is scoped to one customer project. The same email may be an
  admin in multiple customer projects, with independent accounts and
  passwords in each Supabase project.
- New users are created directly with a temporary password, not invited.
- The temporary password has no time-based expiry.
- The temporary password is shown once in `webook`; the central operator
  communicates it to the user.
- A central operator may issue a replacement temporary password at any time.
- Every temporary password requires a password change before normal admin use.
- Reactivating a suspended user issues a new temporary password and requires
  another password change; it never revives a pre-suspension session.
- The first release has no permanent user deletion.
- The first release has no email provider, invite flow, bulk operation, or
  asynchronous queue.
- Existing public-read RLS behavior on `webook.public.users` is explicitly
  unchanged at the user's direction. New Central User Manager tables must not
  inherit that access model.

## Current State

### `webook`

The production Supabase project is `rqizfiayvcbozlzuvbok`.

`public.users.role_id` references `public.roles.id`. The verified role rows are:

| Role ID | English | Thai |
| --- | --- | --- |
| `1` | `Administrator` | `ผู้ดูแลระบบ` |
| `2` | `Operator` | `ผู้ควบคุม` |
| `3` | `Member` | `สมาชิก` |

The current server auth repository resolves a user by Auth UID and then falls
back to email. Central User Manager authorization must not use the email
fallback. It requires an exact match between `auth.users.id` and
`public.users.uid`, with `role_id = 1`.

The current app follows a Server Action to service to repository structure.
Browser code does not call Supabase directly for admin mutations. Central User
Manager follows the same structure.

### `baan-pool-villa`

Each Wrangler environment deploys the same application for a separate
customer, with customer-specific Supabase configuration. The current target
environments are `baanparty`, `baan02`, and `baanPMhee`.

Admin authentication currently verifies a Supabase user and an active row in
`public.admin_users`. Successful checks are cached for 30 seconds. That
positive cache is incompatible with immediate suspension and mandatory
password-change enforcement and must not be used for the revised admin guard.

The target admin source of truth is:

- Supabase `auth.users` for identity and password authentication.
- `public.admin_users` for application authorization.

## Selected Architecture

Use a **Central Control Plane plus Tenant Agent** architecture.

```text
Central Administrator
        |
        v
webook Control Plane
  - role guard
  - project registry
  - operation and audit records
  - signed Agent client
        |
        | Cloudflare Access + signed HTTPS request
        v
baan-pool-villa Tenant Agent
  - fixed local tenant identity
  - operation allowlist
  - idempotency ledger
  - local Supabase secret
        |
        v
Customer Supabase
  - auth.users
  - public.admin_users
```

The target Supabase secret stays in the target Worker. `webook` never stores or
retrieves customer Supabase secret keys at runtime.

### Why This Architecture

- Separate per-project secrets in `webook` would create secret sprawl and
  require central secret configuration for every customer.
- Direct Supabase Management API access from `webook` would give one central
  credential a broad blast radius across all projects.
- Static Cloudflare Service Bindings require each target Worker to be declared
  in the caller configuration, so adding a customer would require a `webook`
  deployment.
- Workers for Platforms dynamic dispatch would require a larger deployment
  model change than this feature needs.
- A narrow Tenant Agent limits a compromised central credential to the
  explicitly supported user-lifecycle operations instead of exposing a full
  Supabase project secret.

## Component Boundaries

### `webook` Control Plane

1. **Central authorization guard**
   - Calls Supabase Auth to obtain the authenticated user.
   - Loads `public.users` by exact `uid` and denies access unless exactly one
     row matches.
   - Requires `role_id = 1`.
   - Does not authorize through email fallback or localized role labels.
   - Runs for the page and again for every Server Action.

2. **Customer project registry**
   - Stores approved target metadata and health.
   - Resolves a target from a server-owned project ID.
   - Never accepts a target URL, Supabase URL, or project ref supplied by the
     browser.

3. **User lifecycle service**
   - Validates the requested action and email.
   - Creates the central operation intent.
   - Calls the Agent client.
   - Records the sanitized result and audit events.

4. **Tenant Agent client**
   - Resolves the exact HTTPS endpoint from the registry.
   - Confirms the origin belongs to the managed Cloudflare account or an
     explicit deployment-owned hostname allowlist.
   - Rejects redirects, private-network targets, non-HTTPS schemes, and
     non-standard ports before attaching credentials.
   - Adds Cloudflare Access service credentials.
   - Canonicalizes and signs the request.
   - Redacts credentials and temporary passwords from logs and errors.

5. **Central User Manager UI**
   - Selects a customer project.
   - Lists target admins.
   - Creates, suspends, reactivates, and reissues temporary passwords.
   - Displays a generated temporary password only in the immediate successful
     response.

### `baan-pool-villa` Tenant Agent

1. **Agent request verifier**
   - Validates the `Cf-Access-Jwt-Assertion` signature, issuer, audience, expiry,
     and expected service-token identity in application code; it does not trust
     the presence of Access headers alone.
   - Verifies the application signature, timestamp, method, path, body hash,
     tenant ID, and operation ID.
   - Rejects stale or altered request envelopes and mismatched tenant
     identities. An exact operation retry uses a fresh timestamp/signature and
     the same operation ID and request hash.

2. **Operation handler**
   - Accepts only the versioned action allowlist.
   - Uses the local Supabase secret and fixed local project configuration.
   - Atomically claims the operation and a per-target mutation lease before
     mutation. Only the lease owner may execute an external side effect.
   - Applies each local `admin_users` mutation and its operation-stage update
     in one idempotent transactional RPC with compare-and-set checks.
   - Records a durable provider-call intent immediately before each Auth side
     effect and a durable outcome immediately after it.
   - Renews the lease with compare-and-set immediately before each provider
     call. The provider hard timeout plus response-processing margin must be
     strictly shorter than the remaining lease.
   - Quarantines the target on an ambiguous provider timeout or an expired
     lease whose last stage is provider-call intent without a recorded outcome;
     it never lets a second Worker automatically replay while the first request
     may still complete.
   - Transfers an unresolved quarantine only to an explicit repair operation
     with a higher credential-version fence. It never releases based only on
     elapsed time or an unchanged snapshot when the provider has no documented
     execution bound.
   - Serializes create, reissue, suspend, reactivate, and forced password
     change for the same immutable normalized email.
   - Never logs or persists a temporary password.

3. **Admin authorization guard**
   - Verifies the Auth user and token claims with Supabase Auth
     (`getUser`/`getClaims`), never with an unverified JWT decode.
   - Requires the token-embedded credential version, the current server-read
     Auth `app_metadata.credential_version`, and the database
     `admin_users.credential_version` to match, then reads `is_active` and
     `must_change_password` on each protected request.
   - Does not use the existing 30-second positive authorization cache.
   - Restricts a user who must change password to the password-change and
     sign-out flows.

4. **Password-change flow**
   - Lets the authenticated user replace the temporary password.
   - Clears `must_change_password` only after the Auth password update,
     explicit global sign-out, and post-sign-out credential-version rotation
     succeed.
   - Leaves the user restricted when completion is uncertain.

### Provisioning Plane

Cloudflare and Supabase Management API credentials belong to deployment and
onboarding automation, not the `webook` runtime. Provisioning creates projects,
applies migrations, configures Auth, writes Worker secrets, configures
Cloudflare Access, verifies the live Auth configuration through the Management
API, records a versioned and timestamped non-secret configuration attestation,
deploys the customer Worker, and finally registers the healthy customer in
`webook`.

Runtime health does not claim to re-read hosted Auth settings. The target
Worker does not hold a Supabase Management API token, so a live Auth
configuration audit remains a provisioning-plane responsibility.

## Data Model

### Central Supabase in `webook`

#### `public.customer_projects`

| Column | Contract |
| --- | --- |
| `id` | UUID primary key and protocol tenant ID |
| `code` | Stable unique human-readable code |
| `display_name` | Customer label shown in `webook` |
| `worker_base_url` | Validated unique HTTPS origin |
| `supabase_project_ref` | Unique non-secret project reference |
| `wrangler_environment` | Unique deployment environment name |
| `status` | `provisioning`, `active`, `suspended`, or `unhealthy` |
| `agent_version` | Last verified Agent contract version |
| `schema_version` | Last verified target schema version |
| `last_health_status` | Sanitized health result |
| `last_health_checked_at` | Last completed health check time |
| `auth_config_attestation_version` | Version of the last provisioning Auth check |
| `auth_config_attestation_digest` | Digest binding project ref, required Auth values, password policy, and check time |
| `auth_config_attested_at` | Time signup and anonymous sign-in were last verified disabled |
| `created_at`, `updated_at` | Audit timestamps |

This table contains no Cloudflare service secret, signing private key, or
Supabase secret.

#### `public.user_management_operations`

| Column | Contract |
| --- | --- |
| `id` | UUID primary key used as `operationId` |
| `customer_project_id` | Target project foreign key |
| `action` | Versioned action allowlist value |
| `target_user_id` | Target Auth UUID when known |
| `target_email` | Normalized target email when applicable |
| `request_hash` | Hash that binds the operation ID to one payload |
| `status` | `pending`, `succeeded`, `failed`, or `needs_review` |
| `result_code` | Sanitized stable outcome code |
| `error_code`, `error_message` | Sanitized failure details |
| `attempt_count` | Number of Agent call attempts |
| `requested_by` | Exact `webook` Auth UID |
| `created_at`, `updated_at`, `completed_at` | Operation timestamps |

Temporary passwords, action links, access tokens, refresh tokens, secret keys,
and signed request values are forbidden from this table.

#### `public.central_user_audit_events`

This append-only table records the actor UID, target project, operation ID,
event type, target user/email, safe before/after state, outcome, and timestamp.
It never records password material or raw provider responses.

All three new tables enable RLS and revoke Data API access from `anon` and
`authenticated`. Server-side repositories use the server-only secret client.

### Customer Supabase in `baan-pool-villa`

#### `public.admin_users`

Add:

```sql
must_change_password boolean not null default false,
credential_version integer not null default 1
  check (credential_version > 0)
```

The existing email remains the only customer-admin profile field used by this
feature. The two new values are internal authorization state, not profile
information.

Server-controlled Auth `app_metadata` stores:

- `credential_version`;
- `bpv_admin_managed = true`; and
- `bpv_created_operation_id` for accounts created by Central User Manager.

The creation-operation marker is internal provenance used to reconcile an
ambiguous `createUser` result and prove ownership before compensation. It is
not profile data and never grants access without the matching `admin_users`
row and authorization checks.

Every later Auth metadata update patches only its owned keys and preserves
Supabase provider metadata plus the managed/provenance markers.

Before enforcing Central writes, rollout normalizes existing admin emails,
fails on case-insensitive duplicates, and adds a database constraint/index that
enforces the selected trimmed-lowercase representation. Application validation
alone is not the uniqueness boundary.

The shared database authorization helper for customer-admin writes must require
all of the following:

- `admin_users.user_id = auth.uid()`;
- `is_active = true`;
- `must_change_password = false`; and
- the verified JWT `app_metadata.credential_version` equals the current
  `admin_users.credential_version`.

This makes stale sessions fail at the database policy boundary as well as the
Next.js API boundary.

The `admin_users` SELECT policy is narrowed to the authenticated user's exact
`user_id`, allowing the server guard to read that user's current authorization
flags even when a password change is required. It does not expose other admin
rows. Central user listing uses the Tenant Agent's server-only secret client,
not this self-select policy.

#### `public.admin_user_operations`

| Column | Contract |
| --- | --- |
| `operation_id` | UUID primary key |
| `action` | Versioned Central action or internal `complete_password_change` |
| `request_hash` | Hash of the canonical request payload |
| `actor_kind` | `central_admin` or `target_admin` |
| `actor_uid` | Signed `webook` Administrator UID or verified target Auth UID |
| `target_user_id` | Target Auth UUID when known |
| `target_email` | Normalized email when applicable |
| `status` | `pending`, `succeeded`, `failed`, or `needs_review` |
| `stage` | Durable action-specific checkpoint around external side effects |
| `fence_version` | Monotonic credential version assigned to an Auth mutation |
| `result_code` | Sanitized stable outcome code |
| `error_code`, `error_message` | Sanitized failure details |
| `lease_expires_at` | Bounded execution lease expiry |
| `attempt_count` | Number of atomic execution claims |
| `created_at`, `updated_at`, `completed_at` | Operation timestamps |

This table is server-only. RLS is enabled and `anon` and `authenticated` have
no access. It never stores temporary passwords.

#### `public.admin_user_mutation_locks`

| Column | Contract |
| --- | --- |
| `target_key` | Primary key derived from the immutable normalized email |
| `operation_id` | Current mutation request or Central operation UUID |
| `owner_kind` | `central_operation` or `password_change` |
| `state` | `leased` or `quarantined` |
| `lease_token_hash` | Hash of an unguessable lease token |
| `lease_expires_at` | Bounded, renewable lease expiry |
| `quarantine_reason` | Safe code for an ambiguous external side effect |
| `updated_at` | Last lease transition time |

A server-only transactional RPC claims the operation row and target lock
together. A second request cannot execute unless it owns the matching lease.
An expired lease is automatically reclaimable only when its durable stage
proves that no provider call could still be in flight. Provider-call intent
without a recorded outcome is ambiguous even when live state still looks
unchanged; it moves to `quarantined` and cannot be reclaimed automatically.
Time elapsed and a live-state snapshot are not sufficient to release it unless
the upstream provider publishes an execution upper bound and the configured
wait exceeds that bound plus a safety margin.

Without such a documented bound, reviewed recovery atomically transfers the
lock to a new operation with a higher `fence_version`; it does not release the
lock first. Every password, ban, unban, and Auth metadata mutation carries its
assigned credential version. A late older write can cause a detectable
Auth/database mismatch or denial of service, but its lower version can never
restore application authorization. Auth-user creation uses the immutable
creation-operation marker and email uniqueness as its equivalent provenance
fence.

The forced password-change flow records an internal operation and uses the
same per-target lock so it cannot interleave with a Central mutation. RLS is
enabled and Data API access is revoked from `anon` and `authenticated`.

Transaction logic belongs in private security-definer functions behind narrow
public RPC wrappers granted only to the server role. A local profile/version
mutation and its durable stage commit together; an RPC response loss is
reconciled from those committed rows instead of repeating an unchecked update.

## Internal API Contract

The Tenant Agent exposes only:

```text
GET  /api/internal/central-user-manager/v1/health
POST /api/internal/central-user-manager/v1/operations
```

Cloudflare Access protects both paths with a Service Auth policy. The
`webook` Worker sends the Access Client ID and Client Secret from Worker
secrets. The Agent validates the resulting Access JWT against the account JWKS
and expected application audience even though Access already sits in front of
the Worker.

### Application Signature

`webook` signs each request with an Ed25519 private key stored as a Worker
secret. Target Workers store only the corresponding public keys.

The canonical signed value is:

```text
v1
<HTTP method>
<exact path>
<tenant ID>
<operation or request ID>
<Unix timestamp>
<SHA-256 body hash>
```

Headers carry the protocol version, key ID, tenant ID, request/operation ID,
timestamp, body hash, and signature. The Agent:

- accepts only a known key ID;
- allows at most 60 seconds of clock skew;
- verifies the signature before parsing action data;
- requires the signed tenant ID to equal the Worker's local tenant ID; and
- rejects an existing operation ID paired with a different request hash.

The 60-second request window prevents replay and is unrelated to temporary
password lifetime. Temporary passwords do not expire automatically.

### Operation Request

```json
{
  "version": 1,
  "tenantId": "customer-project-uuid",
  "operationId": "operation-uuid",
  "actor": {
    "uid": "webook-auth-uuid"
  },
  "action": "create_user",
  "target": {
    "email": "admin@example.com"
  }
}
```

Only action-appropriate fields are accepted. The signed actor UID must match
the central operation actor. Unknown fields, unknown actions, invalid emails,
and user-supplied URLs or project references are rejected.

The UI creates a UUID submission key before invoking a mutation and reuses it
for browser or Server Action retries. That key becomes the Central operation
ID. The central database atomically binds it to the actor and request hash
before dispatch, so a double click or transport retry cannot silently create a
second operation.

### Operation Response

```json
{
  "operationId": "operation-uuid",
  "status": "succeeded",
  "user": {
    "id": "target-auth-uuid",
    "email": "admin@example.com",
    "status": "must_change_password"
  }
}
```

Only a first successful `create_user`, `reissue_temporary_password`, or
`reactivate_user` response may also contain `temporaryPassword`. Such
responses use `Cache-Control: no-store`.

If that one-time response is lost, an idempotent retry returns the completed
operation without the password and instructs the operator to create a new
reissue operation. The password is never persisted merely to make a retry
return it.

## Allowed Actions

### `list_users`

The Agent joins minimal Auth user data with `admin_users`, including the union
of profile rows and Auth users carrying the server-controlled managed-admin
marker, and returns:

- Auth user ID;
- normalized email;
- derived status;
- created time; and
- last sign-in time when available.

No token, identity-provider secret, raw metadata, or password-related value is
returned. Requests use bounded pagination with a maximum page size of 100, and
responses return the next-page indicator needed by the central table. The
Central UI never requests every page merely to render the first screen.

For this read-only action only, the approved implementation uses one
server-only service-role RPC. A private fixed/empty-search-path
`SECURITY DEFINER` function selects only the required documented
`auth.users` fields and `public.admin_users`, full-joins by exact UID, computes
global normalized-email ownership, derives safe status, and applies stable
display-email/UID pagination before returning the strict DTO. The RPC has no
writes, locks, triggers, dynamic SQL, or raw metadata output; its private
implementation is not executable by API roles or `service_role`, and only its
public wrapper is granted to `service_role`. Every mutation continues through
the Auth Admin API and the fenced mutation repositories.

### `create_user`

1. Normalize the email with `email.trim().toLowerCase()` in both central and
   target validation.
2. Reject an invalid email.
3. Check Auth and `admin_users` for an existing account.
4. If both records exist, return a stable duplicate-user result.
5. If only one record exists, return `needs_review`; do not silently attach or
   overwrite an identity.
6. Generate at least 128 bits of entropy using Web Crypto and a communication-
   safe character set while guaranteeing every configured target password
   rule.
7. Call `auth.admin.createUser` with the email, temporary password, and
   `email_confirm: true`. Set server-controlled
   `app_metadata.credential_version = 1`, `bpv_admin_managed = true`, and
   `bpv_created_operation_id = operationId` without overwriting unrelated Auth
   provider metadata.
8. Insert `admin_users` with the returned Auth UUID, normalized email,
   `role = 'admin'`, `is_active = true`, and
   `must_change_password = true`, with `credential_version = 1`.
9. Verify both records.
10. Return the temporary password once.

If step 8 fails after a new Auth user was created, the Agent deletes only an
Auth user whose ID/result and creation-operation marker prove it belongs to
this operation. It never deletes a pre-existing or unmarked user merely because
the email matches. A failed or unprovable compensation changes the operation to
`needs_review`.

### `reissue_temporary_password`

1. Require an existing consistent Auth and `admin_users` pair.
2. Increment `admin_users.credential_version` and set
   `must_change_password = true` first.
3. Generate a new cryptographically random temporary password.
4. Update the Auth password and server-controlled
   `app_metadata.credential_version` to the same new value while preserving
   unrelated Auth provider metadata.
5. Create a non-persistent server-side Auth client, sign in with the new
   temporary password, and require the returned UID to match the target.
6. Pass that transient access JWT to `auth.admin.signOut` with global scope and
   require success, thereby explicitly revoking all refresh sessions for the
   user.
7. Discard the transient session, verify the returned Auth version and database
   state, and return the new password once.

The old password stops working after the Auth update. Existing access JWTs have
the previous credential version, while any token minted during the revocation
window remains blocked by `must_change_password` and becomes stale during the
forced-change version rotations. Both protected APIs and database authorization
compare token version and current `admin_users` state.

If the Auth update fails with a definitive response, the Agent attempts to
restore the previous flag and version. If the result is ambiguous, it leaves
the fail-safe new version and `true` flag and marks the operation
`needs_review`. If transient sign-in or global sign-out cannot be confirmed,
the required-change flag remains true, the operation/target is quarantined,
and no password is returned.

### `suspend_user`

1. Set `admin_users.is_active = false` and increment `credential_version`.
2. Ban the Auth user and write the new credential version to Auth
   `app_metadata`.
3. Verify both states.

Application access stops after step 1 because protected APIs read current
authorization state on every request. A later Auth failure keeps the safe
inactive state and produces `needs_review`. Suspension alone does not claim
that Supabase has revoked every refresh session; secure reactivation replaces
the password and revokes sessions before restoring application access.

### `reactivate_user`

1. Require the existing Auth and `admin_users` pair to be consistent except
   for the expected suspended state.
2. While the database row remains inactive, increment its
   `credential_version` and set `must_change_password = true`.
3. Generate a new temporary password.
4. In one Auth admin update, replace the password, align
   `app_metadata.credential_version`, and unban the user.
5. Sign in through a non-persistent server-side client with the new temporary
   password and require the returned UID to match the target.
6. Use that transient JWT with `auth.admin.signOut` in global scope and require
   success.
7. Discard the transient session, verify Auth state, and set
   `admin_users.is_active = true`.
8. Verify both states and return the new temporary password once.

Reactivation intentionally requires a new temporary password. This prevents a
session created before suspension from becoming usable again when the account
is reactivated. The database remains inactive until Auth is ready, and the
user remains restricted until changing the new temporary password. A failed or
ambiguous transient sign-in/global-sign-out step leaves the database inactive,
quarantines the operation, and returns no password.

## Password-Change Enforcement

The dedicated forced-change route is `/admin/change-password`. An admin with
`is_active = true` and `must_change_password = true` may access only:

- the password-change page;
- the password-change completion action; and
- sign out.

An inactive admin may access only sign out; inactivity takes precedence over
the required-change state and returns a stable `ADMIN_SUSPENDED` denial.

For an active required-change admin, all other admin pages redirect to password
change and all other admin APIs return a stable
`PASSWORD_CHANGE_REQUIRED` error. Direct database mutations also fail because
the shared authorization helper requires `must_change_password = false`.

The password-change page requires the current temporary password, a new
password, and confirmation. A dedicated server action:

1. verifies the access token, active state, required-change flag, and current
   credential version `N`;
2. rejects a new password equal to the submitted temporary password and
   rejects a mismatched confirmation;
3. acquires the same per-email mutation lease used by Central operations and
   then re-reads authorization state, stopping if version `N` is no longer
   current;
4. inside a cleanup-guarded block, creates a non-persistent server-side Auth
   client and verifies the submitted temporary password with
   `signInWithPassword`;
5. requires the transient Auth user ID to equal the already verified caller
   UID;
6. uses a compare-and-set database update to increment
   `credential_version` from `N` to `N + 1` while keeping
   `must_change_password = true`;
7. uses the server-only Auth admin client to update that exact user's password
   and merged `app_metadata.credential_version = N + 1`;
8. signs in through a second non-persistent client with the new password,
   requires the same UID, and passes that JWT to `auth.admin.signOut` with
   global scope;
9. only after global sign-out succeeds uses a second compare-and-set database
   update from `N + 1` to `N + 2` while the required-change flag remains true,
   then aligns Auth `app_metadata.credential_version = N + 2`;
10. clears `must_change_password` only for the exact user and version
    `N + 2`; and
11. in `finally`, attempts global cleanup for every transient session created
    on every exit path, clears the browser session, then releases the lease or
    quarantines it when cleanup is ambiguous, and requires a fresh sign-in with
    the new password.

Both passwords are held only in request memory and are excluded from logs. If
the password/Auth-version update is definitely rejected, the server attempts
to restore version `N` while leaving the required-change flag set. After global
sign-out, a definite failure to align Auth at `N + 2` may restore the database
to `N + 1`, still with the flag set. Any ambiguous Auth result or failure after
an Auth success remains fail-closed with the required-change flag set and
produces a reviewable error. A transient session is never created before the
mutation lease is held. If global session cleanup cannot be confirmed, the
flag is not cleared and the target lock is quarantined. The user can retry with
the password that is currently accepted by Auth after review; no password is
persisted for recovery.

One confirmed global sign-out for a UID satisfies cleanup for all transient
sessions of that user. A later `session_not_found` response is treated as
already cleaned, not as a reason to reopen access.

Both credential-version increments are required:

- `N` to `N + 1` rejects every access JWT issued before the password update;
  and
- `N + 1` to `N + 2`, after global sign-out, rejects the server-only transient
  JWT and any access JWT minted by a refresh race during the change.

Revoking refresh sessions does not invalidate already-issued access JWTs.
Normal authorization is therefore restored only at version `N + 2`, which a
user obtains through a fresh password sign-in.

This flow does not enable the project-wide Supabase **Require current password
when changing password** option, because that would break the existing
OTP-based password-change flow unless it were redesigned at the same time.

The existing positive authorization cache is removed from this decision path.
The guard reads current `is_active` and `must_change_password` values for each
protected request.

## UI Design

The route is `/app/admin/user-manager` inside `webook`.

Desktop uses a compact master-detail layout:

1. left column: searchable customer projects and Agent health;
2. center column: users for the selected project; and
3. right panel or drawer: selected-user details and actions.

Narrow screens stack the flow as Project, Users, then Detail.

### Project List

Each project shows:

- display name and stable code;
- active, provisioning, suspended, or unhealthy status;
- Agent and schema versions; and
- last runtime health-check time; and
- last provisioning Auth-configuration attestation time.

An unhealthy project disables mutations but still shows its last known
operation and health details.

### User Table

Columns are:

- Email;
- Status;
- Created;
- Last sign-in; and
- Actions.

Derived statuses are:

- consistent, active, and `must_change_password` → `รอเปลี่ยนรหัส`;
- consistent, active, and password changed → `ใช้งาน`;
- consistently inactive and banned → `ระงับ`; and
- missing records or mismatched active, ban, email, or credential-version state
  → `ข้อมูลผิดปกติ`.

### Create User

The form contains one Email field. After success, a non-cacheable modal shows
the temporary password once with a copy action and a warning that closing the
modal makes it unrecoverable.

The browser keeps the password only in the current component state. It is
cleared when the modal closes and is not written to storage, URL state,
telemetry, or error reporting.

### Existing User Actions

- Issue a new temporary password.
- Suspend.
- Reactivate and issue a new temporary password.

Issuing a password, suspending, and reactivating require an explicit
confirmation. Reissue and reactivate both use the one-time password modal.
There is no edit-email or delete action in the first release.

A quarantined operation disables further mutations for that user and shows the
safe operation ID, last durable stage, and review reason. It never offers a
blind retry. Its **ตรวจสอบสถานะ** action resubmits the exact operation ID and
hash in reconciliation-only mode. If no documented provider execution bound
exists, recovery transfers the lock directly to a new higher-fence reissue
operation; it never unlocks merely because time passed. The repair returns only
its new one-time password.

## Authorization and Security

### Central Authorization

- Every page load and Server Action verifies a current Auth user.
- The server loads `public.users` by exact Auth UID.
- `role_id` must equal the verified Administrator ID `1`.
- The localized JSON role name is display data, not authorization data.
- The legacy email fallback is forbidden for this feature.
- Hiding a navigation item is never treated as authorization.

### Secret Ownership

`webook` Worker secrets:

- Cloudflare Access Service Client ID;
- Cloudflare Access Service Client Secret; and
- Central Ed25519 signing private key.

Each target Worker secret:

- only that project's Supabase `sb_secret_...` key.

Each target Worker non-secret configuration:

- immutable tenant ID;
- Supabase URL/project ref;
- accepted Central signing public keys and key IDs; and
- Agent/schema version; and
- the provisioning Auth-attestation version, digest, and check time.

Keys are versioned by key ID. Rotation deploys the new public key alongside the
old key, switches the central signer, and removes the old public key after the
overlap window.

### Request and Log Safety

- TLS is mandatory.
- Target origins are exact HTTPS allowlist entries verified against deployment
  ownership. The Agent client uses port 443, does not follow redirects, and
  never attaches Access credentials to localhost, private-network, or
  unverified origins.
- Agent paths receive Cloudflare Access Service Auth protection.
- The Agent verifies the Access JWT signature, issuer, audience, expiry, and
  service-token identity instead of trusting headers alone.
- Signed requests expire after 60 seconds.
- Operation IDs and request hashes prevent replay with changed payloads.
- Temporary passwords are redacted from application, Cloudflare, Supabase,
  audit, telemetry, and error logs.
- Transient Auth access and refresh tokens used for password verification and
  global sign-out exist only in server request memory, use
  `persistSession: false`, and are never returned or logged.
- Responses containing a temporary password use `Cache-Control: no-store`.
- Both internal Agent paths bypass the existing Worker HTML/JSON caches and
  any Next.js data cache.
- Agent errors returned to the browser use stable codes and sanitized messages.
- Rate limits apply per Central identity, target project, and action.
- Atomic operation claims and per-email leases prevent duplicate or
  interleaved lifecycle mutations across Worker isolates.
- Every protected application request requires the verified JWT credential
  version, the current server-read Auth metadata version, and the database
  version to match. Reissue and suspension therefore invalidate old
  application authorization immediately, while a late fenced Auth write fails
  closed as a detectable mismatch.
- Reissue, reactivation, and forced change explicitly obtain a server-only
  transient JWT for the new password and complete a global Auth sign-out before
  returning a password or restoring normal access. The database
  credential-version change independently keeps already-issued access JWTs
  rejected until they expire.

### Existing `webook.public.users` Accepted Risk

The verified production schema currently has an `anon` SELECT policy that can
read every `public.users` row, and the table includes email, telephone, and a
legacy password column. The user explicitly directed this project not to
change that RLS behavior as part of Central User Manager.

This design therefore:

- makes no migration or policy change to the existing table;
- documents the exposure as an accepted pre-existing risk;
- prevents new Central tables from being readable by `anon` or
  `authenticated`; and
- never treats the existing policy as sufficient authorization for Central
  mutations.

This containment does not remove the pre-existing exposure.

## Idempotency and Failure Model

Both central and target operations use:

```text
pending → succeeded
        → failed
        → needs_review
```

- The operation ID is globally unique.
- The browser creates the operation ID before submission and reuses it for
  retries.
- The request hash binds one operation ID to one action and payload.
- Central insertion and target execution claim are atomic unique-key wins;
  observing a `pending` row is not permission to execute it again.
- Repeating the same operation ID and hash returns the recorded non-secret
  outcome.
- Repeating an operation ID with a different hash returns a conflict.
- Mutations with different operation IDs but the same normalized target email
  serialize through one renewable lease.
- The Agent renews by compare-and-set before a provider call and refuses to
  start unless the provider hard timeout plus processing margin fits entirely
  inside the remaining lease.
- Every external side effect has durable before/after stages. A worker that
  takes over an expired lease may resume automatically only when the last stage
  proves that no provider request can still be in flight.
- Provider-call intent without a recorded outcome is ambiguous after either a
  Worker crash or timeout, even if live state still appears unchanged. It
  atomically marks the operation `needs_review` and the target lock
  `quarantined`.
- A provider timeout after dispatch is ambiguous even if the HTTP client was
  aborted; no automatic lease-expiry retry may issue another side effect.
- Repeating that exact quarantined operation is reconciliation-only. After the
  provider's documented maximum execution time plus a safety margin, it may
  compare live state and atomically resolve the lock. If the provider gives no
  documented upper bound, neither time nor a snapshot can release the lock;
  reviewed recovery atomically transfers it to a higher-fence operation.
- Every later Auth mutation carries a credential version greater than the
  quarantined operation's fence. A late old password/metadata/ban write can
  only create a detectable mismatch that fails closed; it cannot authorize a
  stale session. Password recovery never attempts to recover old plaintext.
- Provider errors are mapped to stable internal error codes.
- A partial state is never silently reported as success.
- The UI exposes a clear retry or review path without inventing a new target
  identity.
- If a password-changing side effect succeeded but its response was lost, no
  retry repeats that password mutation merely to reproduce the secret. The
  operation completes without a password and the operator starts a new reissue
  operation.

Cloudflare Queues are intentionally excluded from the first release. User
administration is low volume, and synchronous idempotent operations plus a
persistent staged ledger and per-target leases provide the required safety. A
future queue can consume the same operation contract if bulk operations become
necessary.

## Customer Onboarding

Adding a customer requires deploying that customer's new application but does
not require changing or redeploying `webook`.

1. Create the customer Supabase project and Wrangler environment.
2. Apply the versioned `baan-pool-villa` schema migrations.
3. Use the provisioning-only Supabase Management API credential to disable
   public signup and anonymous sign-in for the target Auth project.
4. Align the target password-strength policy and read the configuration back.
5. Record a versioned, timestamped non-secret Auth-configuration attestation
   whose digest binds the project ref, disabled-signup values, password policy,
   and check time; embed the same digest in the target deployment.
6. Create a dedicated target Supabase secret key.
7. Store that key only in the target Worker secret configuration.
8. Set the immutable tenant ID and accepted Central public keys.
9. Configure Cloudflare Access Service Auth for the Agent paths.
10. Deploy the customer Worker.
11. Add the non-secret project record in `webook`.
12. Run the signed runtime health check.
13. Activate the project only when runtime health and provisioning attestation
    both pass.

The runtime health response verifies:

- immutable tenant ID;
- Supabase project ref;
- Agent contract version;
- schema version;
- required table and column availability;
- Supabase connectivity; and
- the version, digest, and timestamp of the deployment's non-secret
  provisioning attestation, which must match the central registry.

Health never returns secrets, database credentials, user lists, or raw provider
configuration. It does not claim that hosted Auth settings were re-read live.
A Dashboard change after the last attestation is detected only when the
provisioning audit is run again; automatic Management API audits are outside
the first release.

## Rollout

1. Preflight existing email conflicts, normalize safe rows, then add target
   migrations for authorization state, normalized-email enforcement, staged
   operations, and per-target mutation leases, with focused tests.
2. Add the Tenant Agent behind a disabled feature flag.
3. Backfill `app_metadata.credential_version = 1` and
   `bpv_admin_managed = true` for every existing target admin while preserving
   unrelated metadata. Existing sessions issued before this backfill are
   intentionally rejected after enforcement is enabled, so current admins must
   sign in again. Existing accounts do not receive a fabricated
   `bpv_created_operation_id`.
4. Add password-change and credential-version enforcement, update the shared
   database authorization helper, and remove the positive authorization cache
   from the protected path.
5. Configure target secrets, Access, signing public keys, and the verified Auth
   configuration attestation.
6. Deploy and health-check the three current customer projects one at a time.
7. Add the central schema, repositories, services, and signed client to
   `webook`.
8. Add the Central User Manager UI behind a central feature flag.
9. Register the three healthy projects.
10. Run end-to-end create, first-login password change, reissue, suspend, and
    reactivation-with-new-temporary-password tests against a non-production
    test account.
11. Enable the central feature flag.

Migrations are additive. Disabling the central feature flag removes access to
the UI without changing existing customer admin login behavior. Disabling an
Agent route at Cloudflare Access prevents central mutations while leaving the
customer site available.

## Verification

### `webook`

Focused tests must prove:

1. only exact UID matches with `role_id = 1` authorize;
2. email fallback never authorizes Central User Manager;
3. project IDs resolve only to server-owned registry records;
4. invalid, redirected, private-network, non-HTTPS, non-standard-port, and
   unverified Agent origins are rejected before credentials are attached;
5. canonical request generation is deterministic;
6. signature headers cover method, path, tenant, operation, timestamp, and
   body hash;
7. a reused submission key binds to one actor and payload and dispatches at
   most once under double clicks and Server Action retries;
8. temporary passwords are absent from central persistence and logs;
9. completed-operation retries never return a stored password;
10. every Server Action repeats authorization; and
11. loading, empty, unhealthy, duplicate, failed, and `needs_review` UI states
    are usable on desktop and mobile.

### `baan-pool-villa`

Focused tests must prove:

1. Access/signature failures stop before mutation;
2. expired signed requests and tenant mismatches are rejected;
3. repeated operation IDs with different hashes return conflict;
4. only one concurrent request can atomically claim an operation ID;
5. different operation IDs for the same email serialize, including a forced
   password change racing a reissue, suspend, or reactivate;
6. an expired lease reconciles every supported crash stage before resuming,
   while provider-call intent without an outcome—whether caused by crash or
   timeout—quarantines the target and never triggers automatic replay; an exact
   quarantined retry performs read-only reconciliation and cannot unlock from
   time/snapshot alone without a documented provider bound;
7. exact and case/whitespace-variant duplicate emails do not create duplicate
   Auth or profile rows, and rollout stops on conflicting legacy rows;
8. list shows marked Auth-only and profile-only records as inconsistent rather
   than hiding or silently repairing them;
9. create returns a password once and persists no password;
10. Auth creation is compensated when the profile insert fails only when the
    operation marker proves ownership;
11. failed or unprovable compensation produces `needs_review`;
12. reissue sets `must_change_password` and increments the credential version
    before updating Auth;
13. reissue verifies the new password with a transient same-UID sign-in and
    completes global sign-out, while every older access JWT remains rejected by
    its credential version;
14. suspended users lose application and database authorization immediately;
15. reactivation creates and verifies a new temporary password, completes
    global sign-out, aligns the Auth version, and unbans before setting
    `is_active = true`;
16. a password or reactivation response lost after the Auth side effect is not
    recreated from storage or repeated merely to return the secret;
17. password-change-required users can access only the change and sign-out
    flows;
18. password change rejects an incorrect temporary password, an identity
    mismatch, and a new password equal to the temporary password;
19. successful password change acquires the mutation lease before transient
    sign-in, uses compare-and-set `N` to `N + 1`, completes a same-UID new-
    password sign-in and global sign-out, then moves to `N + 2` before clearing
    the flag so pre-change and refresh-race access JWTs remain rejected;
20. database authorization rejects inactive, password-change-required, and
    stale-version JWTs, while the application guard also rejects every mismatch
    among the verified JWT, current Auth metadata, and database versions;
21. `admin_users` self-select exposes only the caller's row while a
    password-change-required user cannot mutate protected content;
22. existing admins receive managed/version metadata before enforcement and old
    sessions must sign in again;
23. the revised admin guard does not reuse the positive authorization cache;
24. runtime health detects schema or deployment-attestation drift without
    claiming a live Management API check;
25. provisioning tests fail activation when signup or anonymous sign-in is
    enabled;
26. the temporary-password verification clients persist no session, are
    created only while holding the lease, and execute cleanup on success,
    mismatch, conflict, timeout, and exception paths; and
27. error responses and logs contain no password or secret material; and
28. a deliberately delayed lower-fence Auth write after a reviewed repair
    produces a detected mismatch and denied authorization, never stale access.

### Repository and Production Checks

For each implementation repository:

- run targeted tests after each logical change;
- run the full test suite;
- run ESLint;
- run the production Next.js/OpenNext build;
- inspect the affected UI on desktop and mobile;
- verify loading, empty, error, long-email, offline-Agent, and one-time-password
  states; and
- perform a production network check showing no password in URLs, logs,
  cacheable responses, or unexpected browser-to-Agent requests.

The `baan-pool-villa` implementation must read the installed Next.js 16 guides
before changing route handlers, routing, caching, or conventions. It must
update `docs/ai/structure.html` when the new routes, helpers, schema ownership,
and verification guidance are implemented.

## Operational Monitoring

- The project list shows current health and version drift.
- `failed` and `needs_review` operations are visible to Administrators.
- Any mismatch between current Auth credential metadata and the database fence
  re-quarantines the user and raises a high-priority mismatch in the Central
  UI.
- Audit events identify actor, project, action, target, result, and time.
- Agent and central logs use the same operation ID for correlation.
- Runtime health checks are on demand in the first release.
- The UI shows the age of the last provisioning Auth attestation and warns when
  it does not match the deployed configuration version.
- Automatic scheduled health checks and external alerts are deferred until
  observed operational need justifies them.

## Cost and Operational Impact

- Every customer adds one named Supabase secret to its existing Worker.
- Cloudflare Access adds a managed service credential and path policy.
- No Cloudflare Queue, Durable Object, Workers for Platforms namespace, or
  separate always-on service is required in the first release.
- User operations are low volume; their Worker and Supabase request cost is
  expected to be negligible relative to normal application traffic.
- Onboarding automation must update Access configuration and deploy the new
  customer Worker, but it does not deploy `webook`.

## Out of Scope

- Customer self-service user creation.
- Managing `webook` users.
- Target roles other than the existing `admin` role.
- User display names, telephone numbers, avatars, or profile editing.
- Email change.
- Invite, recovery-email, magic-link, or SMTP delivery.
- Temporary-password expiry.
- Permanent user deletion.
- Bulk user import or cross-customer bulk actions.
- Cloudflare Queues or scheduled health checks.
- Direct runtime use of Supabase Management API credentials.
- Migrating customer Workers to Workers for Platforms.
- Changing the existing RLS policy or grants on `webook.public.users`.

## References

- [Supabase Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
- [Supabase Admin signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout)
- [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Supabase Auth users](https://supabase.com/docs/guides/auth/users)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase signing out](https://supabase.com/docs/guides/auth/signout)
- [Supabase Management API](https://supabase.com/docs/reference/api/getting-started)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Workers request signing](https://developers.cloudflare.com/workers/examples/signing-requests/)
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Cloudflare Workers Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Workers for Platforms dynamic dispatch](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/dynamic-dispatch/)
