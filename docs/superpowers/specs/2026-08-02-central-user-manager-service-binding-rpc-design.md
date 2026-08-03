# Central User Manager — Private Service Binding RPC Design

Date: 2026-08-02
Status: Approved design; implementation in progress in the current local scope

## 1. Goal

Keep all five Central User Manager capabilities while making the Tenant Agent
callable only by the `webook` backend:

- `list_users`
- `create_user`
- `reissue_temporary_password`
- `suspend_user`
- `reactivate_user`

Replace the public HTTP and per-Tenant Bearer transport with one explicit
Cloudflare Service Binding per Tenant. Remove transport, credential, health,
and provisioning machinery that is no longer required. Preserve the operation
state machines and database authorization controls that protect correctness.

## 2. Confirmed Decisions

- `webook` and every Tenant Worker run in the same Cloudflare account.
- Adding a Tenant may redeploy `webook`.
- The Browser never calls a Tenant Agent directly.
- The Tenant Agent exposes no public Central User Manager HTTP endpoint.
- Named RPC replaces Bearer authentication; the two modes do not coexist after
  a Tenant is activated on RPC.
- The existing Tenant Worker hosts the named RPC entrypoint. A separate private
  Worker is not introduced.
- The RPC surface contains one method, `executeOperation`.
- `list_users` is the activation/readiness check. There is no separate runtime
  health RPC.
- The existing five actions, one-time temporary-password behavior, operation
  fencing, idempotency, mutation locks, audit, quarantine, reconciliation, and
  credential fence remain in scope.
- Cloudflare deployment permissions and the `webook` Service Binding are the
  caller trust boundary.
- Production database project `zkxpozvhvmgqfrwnlfrn` is not cloned into or
  modified for this migration.
- Existing Staging database project `lsbbbbibhtbwrvrqggwq` is cleaned through
  reviewed additive cleanup migrations rather than replaced from Production.
- Any new `webook` Staging deployment belongs only to the Cloudflare account/
  workers.dev identity `chaymanus2003`; deployment through `poolvilla` is
  prohibited.

## 3. Architecture

```text
Browser
  |
  | webook session; exact central-admin authorization
  v
webook backend
  - accepts only Tenant UUID, operation UUID, action, and strict payload
  - resolves a compile-time allowlisted Tenant binding
  - never accepts a Worker name, binding name, URL, or destination from Browser
  |
  | Cloudflare Service Binding to named entrypoint
  v
baan-pool-villa Tenant Worker
  - CentralUserManagerEntrypoint.executeOperation(...)
  - fixed local Tenant identity
  - strict contract parsing and canonical request hashing
  - existing operation service and safe result projection
  |
  v
Tenant Supabase project
```

Service Bindings are capabilities configured on the caller. They invoke another
Worker without a publicly accessible URL. A binding targets the named Central
User Manager entrypoint rather than the Tenant Worker's public `fetch` handler.

References:

- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/

## 4. Trust Boundary and Tenant Resolution

`webook` declares one explicit named-entrypoint Service Binding per active or
provisioning Tenant. Adding or removing a Tenant changes `webook` deployment
configuration and its server-owned resolver, then redeploys `webook`.

The Browser may submit only a Tenant UUID. It cannot submit or influence a
Worker script name, binding property name, hostname, URL, route, project
reference, or Supabase secret. The backend resolves the verified Tenant UUID
through an explicit allowlist of bindings included in the deployment. Unknown,
inactive, duplicate, or unconfigured Tenant identities fail before RPC.

The RPC entrypoint compares the parsed request Tenant UUID with its fixed local
Tenant UUID before creating a privileged Supabase client. This retains a
defense-in-depth check against a central resolver or deployment misbinding.

An external caller cannot acquire a Service Binding by presenting an HTTP
header or credential. A different Worker in the same account can call the
entrypoint only after an operator with sufficient Cloudflare deployment
authority explicitly grants it a binding. Cloudflare API tokens and human roles
used for Worker deployment must therefore be scoped to the smallest practical
set of scripts and environments.

## 5. RPC Contract

The named entrypoint exposes exactly one method:

```ts
executeOperation(input: unknown): Promise<CentralUserRpcResult>
```

The accepted request has exact keys only:

```ts
interface CentralUserRpcRequest {
  protocolVersion: 1;
  tenantId: string;
  operationId: string;
  actorUid: string;
  action:
    | "list_users"
    | "create_user"
    | "reissue_temporary_password"
    | "suspend_user"
    | "reactivate_user";
  payload: { page: number; pageSize: number } | { email: string };
}
```

The parser rejects inherited, missing, extra, malformed, oversized, or
unsupported values. UUIDs remain canonical RFC 9562 UUIDs. Listing retains the
existing page and page-size bounds. Mutation email input remains normalized and
validated by the existing narrow owner. No transport object, `Request`,
`Response`, header, URL, binding name, secret, or caller-supplied provider
configuration enters the operation service.

The entrypoint returns plain structured-clone-compatible data. It does not
return RPC stubs or application objects with callable methods.

## 6. Canonical Request Identity

The HTTP implementation hashes exact request bytes. RPC has no meaningful raw
HTTP body, so the replacement hashes a canonical representation produced only
after strict parsing:

```text
protocolVersion
tenantId
operationId
actorUid
action
payload fields in fixed action-specific order
```

Canonical serialization must use one fixed encoding and explicit field order;
it must not depend on caller object key order, prototypes, locale, or generic
recursive serialization. The hash remains SHA-256 and continues to bind an
operation UUID to one exact normalized request. An identical retry produces the
same hash. Reusing an operation UUID with any different normalized field
remains a conflict.

## 7. Execution and Response Safety

After validation, Tenant comparison, and request hashing, the entrypoint creates
the existing production operation context and calls the existing operation
service. Auth and database mutation semantics remain unchanged.

The safe projection layer remains responsible for:

- exact operation ID, action, status, and stage binding;
- bounded user-list and pagination output;
- allowlisted user fields and statuses;
- allowlisted safe error codes and messages;
- returning a temporary password only for the successful create or reissue
  operation that produced it; and
- excluding Supabase keys, provider tokens, raw provider errors, operation
  leases, password hashes, and internal evidence.

The entrypoint catches unclassified exceptions and returns one safe unavailable
result. It never serializes or rethrows raw Supabase, Auth provider, RPC, or
configuration errors across the Service Binding. `webook` translates the safe
RPC result into its Browser-facing no-store HTTP response.

## 8. Configuration Kept

The Tenant runtime keeps only configuration needed by the retained behavior:

- one Central User Manager enabled/disabled kill switch;
- fixed Tenant UUID;
- fixed Supabase project reference where required for identity checks;
- `SUPABASE_SECRET_KEY` as a server-only Worker secret; and
- protocol version `1` in code and the RPC request.

The credential fence is always enforced after its schema rollout. It is not a
runtime compatibility fallback. Existing database RLS, private definer
functions, service-role grants, operation tables, mutation locks, fences, audit
events, and recovery evidence remain.

Supabase Auth configuration requirements, including disabled public signup and
the approved password policy, move to provisioning/deployment verification.
They are not represented by a runtime health method, stored attestation digest,
or request field.

## 9. Removed Runtime and Provisioning Surface

Implementation removes, rather than retains as fallback:

- both public Central User Manager HTTP route handlers;
- Bearer parsing, canonical token validation, hashing, and comparison;
- per-Tenant Bearer token and token-version configuration;
- Worker rate limiting dedicated to the removed public endpoints;
- HTTP method, content type, Authorization header, body-reader, body-size, and
  Agent response-header handling;
- public Agent origin storage and validation for dispatch;
- the central Agent HTTP fetch client, redirect rules, and Bearer attachment;
- Bearer generation/validation, encrypted storage, fingerprinting, KEK, and
  rotation workflows;
- runtime health route, health response contract, health service, token/schema/
  agent version reporting, and Auth attestation transport;
- tests and documentation whose only subject is the removed HTTP/Bearer/health
  design; and
- required-secret declarations for the removed Bearer and central token KEK.

The old exact HTTP paths are intercepted at the Tenant Worker boundary and
return a uniform `404` without invoking Next.js, parsing Authorization, creating
a Supabase client, or revealing whether a Tenant Agent is enabled.

Source-controlled Supabase migrations remain immutable schema history. An
unused health-probe function already applied online is not erased from old
migration files. A later additive migration may revoke and remove it only after
all deployed callers are proven absent and the change is separately approved.

## 10. Database Cleanup Boundary

The database is not refreshed or cloned from Production. Production project
`zkxpozvhvmgqfrwnlfrn` is a read-only comparison source during planning and
verification only. No cleanup, dump/restore, migration, function call, or test
write targets Production.

Staging project `lsbbbbibhtbwrvrqggwq` is the only initial online cleanup
target. Cleanup uses a new source-controlled, minimal, idempotent migration or
patch SQL after the RPC cutover proves that the removed objects have no callers.
Existing migration history is never rewritten or deleted.

Before writing cleanup SQL, inventory the live Staging schema and current code
for every candidate object. The inventory must include dependencies, grants,
RLS/policies, functions, triggers, views, publications, generated types, tests,
and row counts. Save a recoverable database backup or verified restore point and
record only non-secret evidence. The migration must resolve and assert the exact
Staging project reference before destructive statements are approved for
execution.

### 10.1 Tenant database candidates

The current Central User Manager operation tables are retained:

- `public.admin_user_operations`;
- `public.admin_user_mutation_locks`;
- `public.admin_user_mutation_fences`;
- `public.admin_user_provider_events`; and
- the `must_change_password` and `credential_version` columns on
  `public.admin_users`.

They implement the five retained actions' idempotency, locking, fencing,
provider evidence, reconciliation, and credential authorization. They are not
cleanup candidates.

After all HTTP health callers and contract tests are removed, the following
health-only functions and their grants are cleanup candidates, subject to an
exact live dependency check:

- `public.central_user_manager_health_probe_v1()`;
- `private.central_user_manager_health_probe_v1_impl()`;
- `private.central_user_manager_suspension_checkpoint_health_v1()`; and
- `private.central_user_manager_forced_password_health_v1()`.

No table or column is dropped merely because its name appears Central User
Manager-specific. A table/column drop requires proof of zero retained runtime,
repair, audit, migration, reporting, or rollback ownership plus a reviewed data
retention decision.

### 10.2 webook database candidates

The `webook` repository and live Staging schema must be inspected before naming
exact objects. After RPC cutover, fields or tables used only for Agent origins,
Bearer ciphertext/IV, token and KEK versions, fingerprints, token rotation, or
HTTP dispatch become cleanup candidates. Tenant identity, activation state,
binding resolver identity, operation idempotency, central audit, and
reconciliation data remain.

The `webook` cleanup is a separate reviewed migration in that repository. It
must first remove all application readers/writers, prove the RPC deployment can
operate without the legacy fields, and then drop only the exact unused objects.
No guessed table or column name is authorized by this design.

### 10.3 Destructive execution gate

Schema cleanup is not bundled silently into application deployment. Execution
requires a separate apply approval containing the resolved Staging project ref,
exact SQL diff, dependency report, backup/restore evidence, and rollback or
repair-forward procedure. Dry-run and inspection steps must not print database
passwords, Supabase secret keys, Auth tokens, or user credentials.

## 11. Items Deliberately Retained

The following code may be substantial but is not transport overhead and must
not be removed merely to reduce line count:

- the five action implementations;
- strict request and response contracts;
- credential version and forced-password-change fences;
- normalized-email ownership checks;
- Auth/database reconciliation;
- operation idempotency and exact-retry binding;
- mutation locks and monotonic fences;
- provider intent/outcome evidence;
- quarantine for ambiguous mutations;
- compensation and repair behavior;
- audit records; and
- one-time temporary-password handling.

These controls prevent duplicate, cross-user, stale, or partially completed
Auth/database mutations. Removing them would change product correctness and
security rather than merely simplify transport.

## 12. webook Staging Deployment Boundary

If the RPC caller is implemented or tested in `webook`, create a distinct
`webook` Staging Worker in the Cloudflare account whose workers.dev identity is
exactly `chaymanus2003`. It must have isolated Staging bindings, secrets,
storage/cache resources, and Tenant resolver entries. It receives bindings only
to approved Staging Tenant Workers and never to a Production Tenant Agent.

Deployment automation must fail closed unless all of the following are true:

- the selected environment is explicitly `staging`;
- the authenticated immutable Cloudflare account ID is exactly
  `0df55f166fa309dcc904e992c43f86db`, the verified account for
  `chaymanus2003`;
- the expected staging workers.dev hostname ends exactly in
  `.chaymanus2003.workers.dev`;
- the Worker name is the dedicated `webook` Staging name;
- every configured Service Binding targets an allowlisted Staging Worker; and
- the authenticated Cloudflare account is not the account identity known as
  `poolvilla`.

Human-readable account names and workers.dev identities are not used as
substitutes for immutable Cloudflare account IDs. The deployment allowlist has
exactly one account ID: `0df55f166fa309dcc904e992c43f86db`. Because every
other ID fails closed, the account identity known as `poolvilla` is denied
without adding a second mutable identity mapping. Any missing or mismatched
identity stops before build upload, secret mutation, route change, or
deployment.

Production and Staging resources must not share Service Bindings, KV/R2/Durable
Object namespaces, cache buckets, deployment secrets, or Supabase keys. Creating
the `webook` Staging Worker and granting its Tenant bindings is an explicitly
approved deployment operation separate from writing application code.

## 13. Tenant Migration

Migrate one Tenant at a time with no active Bearer/RPC overlap:

1. Mark the Tenant inactive in `webook` and stop new operations.
2. Resolve or explicitly quarantine every in-flight mutation.
3. Deploy the Tenant Worker with the named RPC entrypoint, the old public paths
   returning `404`, and the retained operation/configuration owners.
4. Add the exact named-entrypoint Service Binding and allowlisted Tenant
   resolver entry to `webook`, then deploy `webook`.
5. Through `webook`, call RPC `list_users` and verify Tenant identity, protocol,
   safe result shape, Supabase access, and reconciled data.
6. Exercise the four mutation actions against approved disposable staging users
   before the first production rollout. Production activation does not create a
   synthetic user.
7. Mark the Tenant active only after its required checks pass.
8. Delete the unused Tenant Bearer secret and central encrypted token material.
9. Confirm the removed secrets, routes, logs, registry fields, and fallback code
   are absent before migrating the next Tenant.

Adding a new Tenant after migration deploys the Tenant Worker first, then adds
one binding/resolver entry and redeploys `webook`. It does not create a Bearer,
Agent origin, encrypted token row, fingerprint, or rotation state.

## 14. Failure and Rollback

Any binding, protocol, Tenant identity, configuration, validation, Supabase, or
safe-projection failure leaves the Tenant inactive. RPC transport failure is a
safe unavailable result at the central boundary. Ambiguous mutations continue
to enter the existing quarantine/reconciliation flow and are never replayed
automatically.

Rollback does not restore the public Bearer endpoints. Roll back only to a
previous mutually compatible RPC deployment of both sides, keeping the Tenant
inactive until `list_users` and required reconciliation checks pass. If no
compatible RPC revision exists, leave the Tenant inactive and repair forward.

Database cleanup rollback uses the verified Staging restore point or an
explicit repair-forward migration. It never reads from or restores over
Production. A Cloudflare account/target mismatch is non-retryable until the
operator selects the authenticated `chaymanus2003` account and the exact Staging
environment.

## 15. Verification

### Tenant unit and contract tests

- named entrypoint exports only `executeOperation`;
- exact request keys and `protocolVersion: 1` are required;
- inherited/extra/missing values, invalid UUIDs, invalid actions, invalid page
  bounds, invalid emails, and wrong Tenant identity fail before client creation;
- canonical hashes are stable across input key order and change for every
  normalized identity/action/payload change;
- all five actions reach the existing operation service with the exact parsed
  request;
- raw dependency errors become one safe unavailable result;
- safe projection and one-time password rules remain unchanged; and
- the disabled kill switch fails before privileged client creation.

### Worker and public-boundary tests

- both legacy public paths return uniform `404` for no credential, an old valid
  Bearer, a malformed Bearer, every method, and both public host variants;
- legacy paths do not invoke Next.js, the rate limiter, RPC entrypoint, or
  Supabase;
- ordinary public/admin/cache behavior remains unchanged; and
- Worker configuration contains no Central User Manager Bearer requirement.

### webook integration tests

- Browser input cannot select a Worker, URL, origin, or binding name;
- unknown/inactive/unconfigured Tenant UUIDs fail before RPC;
- Tenant A resolves only binding A and Tenant B only binding B;
- a deliberately misbound Tenant fails the Tenant identity check;
- operation retries retain exact idempotency/conflict behavior;
- RPC unavailable and safe Agent errors map to stable no-store Browser errors;
  and
- adding a Tenant requires a binding/resolver change and deployment, not token
  provisioning.

### Repository and staging gates

- run focused Central User Manager, Worker, admin authorization, credential
  fence, and migration contract tests;
- run the narrow Central User Manager production composition typecheck;
- run lint, full tests, and production build in every changed repository;
- verify public legacy paths return `404` even when supplied the retired Bearer;
- verify binding-only `list_users` succeeds and returns no secret or internal
  destination data;
- inspect logs and Browser responses for no Bearer, binding name, Worker target,
  Supabase secret, raw provider error, or retained temporary password; and
- verify Cloudflare configuration grants the named binding only to the intended
  `webook` deployment;
- prove Staging deployment resolves the immutable account ID registered for
  `chaymanus2003` and fails before upload for `poolvilla` or any other account;
- verify the `webook` Staging Worker has only Staging Tenant bindings and
  isolated Staging resources;
- compare live Staging database dependencies with every cleanup statement;
- verify the cleanup migration refuses any project other than
  `lsbbbbibhtbwrvrqggwq` and never connects to
  `zkxpozvhvmgqfrwnlfrn` for writes; and
- after cleanup, rerun database advisors, operation/reconciliation tests, RLS
  checks, all five actions, and schema inspection proving only approved objects
  were removed.

## 16. Acceptance Criteria

- All five approved actions work through the `webook` backend.
- No Internet request can reach Central User Manager code on a Tenant Worker.
- Possession of any retired Bearer does not change the legacy paths' `404`
  response.
- The Browser cannot choose or learn an Agent destination or binding.
- No Bearer, KEK, Agent-origin, fingerprint, token-version, HTTP Agent client,
  or runtime health transport remains in active code or configuration.
- One explicit Service Binding and resolver entry is required per Tenant.
- Wrong-Tenant bindings fail before privileged work.
- Existing operation correctness, safe-result, credential-fence, quarantine,
  and one-time-password behavior remains covered and passing.
- Migration and rollback never reactivate a public Bearer fallback.
- Production project `zkxpozvhvmgqfrwnlfrn` is neither cloned nor modified.
- Staging database cleanup affects only reviewed unused objects in
  `lsbbbbibhtbwrvrqggwq` and retains all operation-safety data structures.
- `webook` Staging deploys only through the immutable Cloudflare account ID
  verified for `chaymanus2003`; `poolvilla` and every other account fail closed
  before mutation or upload.
