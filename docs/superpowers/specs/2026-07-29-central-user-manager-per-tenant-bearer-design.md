# Central User Manager — Per-Tenant Bearer Design

Date: 2026-07-29
Status: Approved design; implementation not started

## 1. Goal

Provide a simpler authentication variant for the approved Central User Manager:

- `webook` remains the central UI and Control Plane.
- Each `baan-pool-villa` deployment remains the Tenant Agent for one customer.
- `webook` calls each Tenant Agent with a different API Bearer token.
- Adding a Tenant deploys and registers only that Tenant; it does not rebuild or
  deploy `webook`.
- The existing user lifecycle, one-time temporary-password behavior,
  idempotency, quarantine, audit, and forced-password-change design remain
  unchanged.

This variant replaces Cloudflare Access and Ed25519 request signing. It does not
run alongside them.

## 2. Confirmed Decisions

- One Bearer token per Tenant.
- Bearer authentication replaces both Cloudflare Access and Ed25519.
- A new Tenant must be addable without deploying `webook`.
- The operator supplies the same token to the Tenant Worker and the `webook`
  registry through a provisioning tool.
- Token rotation is an immediate cutover. Short per-Tenant downtime is
  accepted; there is no old/new overlap.
- All previously approved Central User Manager capabilities and lifecycle
  semantics remain in scope.
- The original Central User Manager design remains as a separate architecture
  record. This document is the canonical authentication design for the Bearer
  variant.

## 3. Architecture

```text
Browser
  |
  | webook session; exact Auth UID + role_id = 1
  v
webook Central Control Plane
  - customer registry
  - encrypted per-Tenant Bearer tokens
  - central operation idempotency
  - append-only audit
  - no target Supabase keys
  |
  | exact registry HTTPS origin
  | Authorization: Bearer <Tenant token>
  v
baan-pool-villa Tenant Agent
  - exact local Tenant identity
  - its own expected Bearer token
  - its own Supabase secret
  - operation and lock state machine
  |
  v
Tenant Supabase project
```

The Browser never receives the Agent origin, Bearer token, target Supabase
project reference, target Supabase key, encryption key, or raw provider errors.
The Browser may submit only a Tenant UUID, Operation UUID, action, and strict
action payload. `webook` resolves all trust-sensitive values from server-owned
state.

## 4. Component Boundaries

### 4.1 `webook` Control Plane

The Control Plane:

- authorizes the current operator by exact Supabase Auth UID and exactly one
  `public.users` row with `role_id = 1`;
- resolves an active Tenant from the server-owned registry;
- decrypts that Tenant's Bearer token only in server memory;
- creates the exact Agent URL from the verified registry origin;
- attaches the Bearer token to the outbound request;
- owns central operation binding, audit, timeout handling, and reconciliation;
- never persists a temporary password; and
- never sends a token, Agent origin, or target project details to Client
  Components.

### 4.2 Tenant Agent

The Tenant Agent:

- exposes only the approved internal health and operation routes;
- validates the Bearer credential before parsing or executing an operation;
- verifies the request Tenant ID against its fixed local Tenant ID;
- owns target operation idempotency, mutation locks, fencing, quarantine, and
  Supabase Auth Admin API calls;
- stores only its own expected Bearer token and Supabase secret; and
- never accepts an Agent URL, target project reference, secret, or actor identity
  directly from a Browser.

### 4.3 Provisioning Tool

The provisioning CLI is the only supported path for registering or rotating a
Tenant token. It:

- accepts a token through a hidden prompt or bounded standard input;
- never accepts the token as a command-line argument;
- validates the token format and entropy representation;
- installs the token as the target Tenant Worker secret;
- encrypts and stores the same token in the `webook` registry;
- runs the authenticated health and read-only list checks; and
- activates the Tenant only after all identity and version checks pass.

No Browser form accepts or displays the Bearer token.

## 5. Bearer Token Contract

### 5.1 Token Format

Each token represents exactly 32 cryptographically random bytes and is encoded
as unpadded base64url:

```text
43 characters from A-Z, a-z, 0-9, "-" and "_"
```

Provisioning may generate a token with a cryptographically secure random source
or accept an operator-generated token that satisfies the exact format. Tokens
must never use `Math.random()`, UUIDs, human passwords, API URLs, Tenant names,
or reusable organization-wide secrets.

### 5.2 Request Header

Agent requests use exactly:

```http
Authorization: Bearer <43-character token>
```

The parser accepts one `Authorization` value with the literal scheme `Bearer`,
one ASCII space, and one valid token. It rejects:

- missing or duplicate credentials;
- alternate schemes;
- lowercase or mixed-case schemes;
- leading or trailing data;
- extra whitespace;
- comma-separated credentials; and
- tokens with an invalid character, decoded size, or length.

Missing or invalid credentials return `401` with:

```http
WWW-Authenticate: Bearer
```

An absent or invalid expected Tenant secret is a server configuration failure
and returns `503`, not `401`.

### 5.3 Timing-Safe Comparison

The Agent hashes the supplied and expected tokens with SHA-256, then compares
the two fixed-length digests with a constant-work byte comparison. It does not
compare the original strings with `===`.

Token parsing, hashing, comparison, and errors must not log the supplied token,
expected token, Authorization header, digest, or derived credential material.

## 6. Central Token Storage

### 6.1 Encryption

`webook` stores a token only as AES-256-GCM ciphertext. The key-encryption key
(KEK) is a single server-only Worker secret:

```text
CENTRAL_USER_MANAGER_TOKEN_KEK
```

The KEK decodes to exactly 32 bytes. It is never stored in the database,
returned by an API, exposed through `NEXT_PUBLIC_*`, or accepted from a Browser.

Each encryption uses a new 96-bit cryptographically random IV. AES-GCM
additional authenticated data binds the ciphertext to its registry record:

```text
CUM-BEARER-TOKEN-V1
<tenant UUID>
<token version>
<KEK version>
```

There is no trailing newline. Copying ciphertext or its IV to another Tenant,
token version, or KEK version must fail authentication during decryption.

### 6.2 Registry Fields

The server-only Tenant registry adds fields equivalent to:

```text
bearer_token_ciphertext
bearer_token_iv
bearer_token_version
bearer_token_kek_version
bearer_token_fingerprint
bearer_token_updated_at
```

The exact SQL representation is selected during implementation to match the
existing `webook` schema. Browser-facing projections exclude every field above.

The fingerprint is a non-reversible SHA-256 identifier used only to confirm
which token version is installed during operator workflows. It is never used
as the request credential and is not shown in full in the UI or logs.

Only the server-side registry repository may select encrypted token fields.
Decryption occurs immediately before an Agent fetch, and the plaintext
reference is discarded when the request finishes.

### 6.3 KEK Rotation

KEK rotation is independent from Tenant-token rotation. Registry rows record
the KEK version so a controlled migration can decrypt with the old KEK and
reencrypt with the new KEK. The migration must:

1. keep both KEKs server-only during the bounded migration;
2. reencrypt each row with a fresh IV and incremented KEK version;
3. verify decryption and Tenant-bound AAD;
4. remove the old KEK only after every active row is verified; and
5. avoid changing Tenant Worker secrets because the plaintext Tenant tokens do
   not change.

## 7. Internal API Contract

Exact Agent paths remain:

```text
GET  /api/internal/central-user-manager/v1/health
POST /api/internal/central-user-manager/v1/operations
```

Supported operation actions remain:

```text
list_users
create_user
reissue_temporary_password
suspend_user
reactivate_user
```

The health request has no body and includes:

```http
Authorization: Bearer <Tenant token>
X-CUM-Version: 1
```

The operation request includes:

```http
Authorization: Bearer <Tenant token>
X-CUM-Version: 1
Content-Type: application/json
```

An operation body has this strict shape:

```json
{
  "tenantId": "UUID",
  "operationId": "UUID",
  "actorUid": "webook Auth UID",
  "action": "supported action",
  "payload": {}
}
```

`webook` supplies `tenantId` and `actorUid` from verified server context. It
does not copy Browser-provided values into those fields.

The Agent validates in this order:

1. exact route and HTTP method;
2. expected local secret configuration;
3. exact Bearer syntax and timing-safe credential comparison;
4. bounded request size and exact content type;
5. JSON syntax and strict no-extra-keys schema;
6. exact local Tenant identity;
7. operation claim and idempotency binding; and
8. action-specific authorization and execution.

Operation bodies remain capped at 16 KiB. `list_users` page size remains
`1..100`.

## 8. Network and Destination Safety

Bearer authentication does not weaken outbound destination controls.
`webook` must:

- resolve the Agent origin only from the server-owned registry;
- accept only an exact normalized HTTPS origin on port 443;
- reject credentials, path, query, fragment, localhost, IP literals, private,
  loopback, link-local, and unsafe/confusable host forms;
- construct URLs by combining an approved constant path with that origin;
- use `redirect: "error"` and `cache: "no-store"`;
- apply a bounded timeout, with the default remaining 10 seconds;
- cap response bytes before JSON parsing; and
- validate the response protocol, Tenant identity, and safe response schema.

The Tenant Worker cache layer must bypass both internal Agent paths before any
cache lookup or write.

## 9. Response and Error Contract

Every Agent and Control Plane response in this flow includes:

```http
Cache-Control: private, no-store, max-age=0
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

There are no redirects. Primary statuses are:

| Status | Meaning |
| --- | --- |
| `401` | Bearer credential missing or invalid |
| `403` | Tenant identity or authorized server context mismatch |
| `409` | Operation conflict, in progress, quarantined, or needs review |
| `413` | Request body exceeds the limit |
| `415` | Unsupported content type |
| `422` | Strict payload validation failure |
| `429` | Agent rate limit exceeded |
| `503` | Expected secret/configuration or provider unavailable |

Errors expose only stable safe codes and bounded messages. They never reflect
the Authorization header, token, ciphertext, IV, provider body, Supabase
secret, temporary password, or untrusted HTML.

## 10. Operation and Lifecycle Semantics

The approved operation model is unchanged:

- Browser-generated operation UUIDs are preserved across a double-click or
  transport retry.
- Central storage atomically binds operation ID, Tenant ID, actor UID, action,
  normalized payload, and request hash.
- Target storage independently binds and fences the same operation.
- The same UUID with a changed binding is rejected.
- Mutation intent is durable before a provider call.
- An ambiguous provider or network outcome is quarantined and is never
  automatically replayed.
- Reconciliation uses the exact existing operation and is read-only with
  respect to an ambiguous mutation.
- Temporary passwords are returned once, kept only in memory, never persisted,
  logged, cached, or recreated merely to reproduce a lost response.

The user actions and semantics remain:

- list users;
- create a user with an email and one-time temporary password;
- reissue a temporary password;
- suspend a user;
- reactivate a user only with a new temporary password; and
- force a temporary-password user to change the password before using protected
  admin functions.

The credential-version fence, target `admin_users` checks, target RLS
hardening, operation locks, quarantine, and forced-password-change flow remain
as specified in the original approved design.

The approved `list_users` implementation has one narrow read-only exception to
the Auth Admin API boundary: a server-only repository calls a service-role-only
public RPC whose private `SECURITY DEFINER` implementation performs one
snapshot `FULL OUTER JOIN` of documented `auth.users` fields and
`public.admin_users` by exact UID. It computes global normalized-email
ownership before stable `(normalized display email, UID)` pagination and
returns only the strict safe list DTO. The function may only `SELECT`; it may
not write or lock Auth/profile data, return raw metadata, use dynamic SQL, or
be executed directly by `PUBLIC`, `anon`, `authenticated`, or `service_role`.
This exception applies only to `list_users`. All Auth mutation and mutation
reconciliation paths continue to use the Auth Admin API.

## 11. Provisioning and Onboarding

For a new Tenant:

1. Provision and attest the target Supabase Auth configuration.
2. Create or receive one valid 32-byte base64url token through a hidden input.
3. Register the project in `webook` as inactive.
4. Install the token as the target Worker's
   `CENTRAL_USER_MANAGER_BEARER_TOKEN` secret.
5. Encrypt the same token with the current `webook` KEK and store it in the
   inactive registry row.
6. Deploy only the target Tenant Worker.
7. Call the exact authenticated health endpoint.
8. Verify Tenant ID, target project identity, Agent/schema version, Auth
   attestation, and token version.
9. Run an authenticated read-only `list_users` operation.
10. Activate the registry row atomically.

No `webook` build or deployment is part of this flow.

If any step fails, the registry stays inactive. The tool prints only a redacted
recovery reference and does not automatically undo proven external state.

## 12. Immediate Token Rotation

Rotation intentionally provides no overlap between old and new tokens:

1. Mark the Tenant inactive in the central registry.
2. Stop new dispatches and resolve or explicitly quarantine in-flight
   mutations.
3. Accept a new valid token through hidden input.
4. Replace the target Worker secret and deploy only that Tenant.
5. Encrypt the new token into the registry and increment the token version.
6. Call health and `list_users` with the new token.
7. Reactivate the Tenant only after both checks pass.

During steps 1–7, Central User Manager operations for that Tenant are
unavailable. Other Tenants remain available.

If target installation succeeds but central registration or verification
fails, the Tenant stays inactive. The tool does not silently restore the old
token or activate an unverified pairing.

## 13. Audit and Observability

Audit records retain:

- operation ID;
- Tenant ID;
- verified central actor UID;
- action;
- normalized non-secret target identifier;
- token version and bounded fingerprint prefix;
- result and safe error code;
- operation stage and timestamps; and
- provisioning, activation, deactivation, rotation, and reconciliation events.

Audit records never retain:

- Bearer tokens or Authorization headers;
- ciphertext, IVs, KEKs, or full fingerprints;
- temporary or permanent passwords;
- access or refresh tokens;
- target Supabase secrets; or
- raw provider request or response bodies.

Application logs follow the same restrictions. Diagnostic correlation uses
operation IDs and safe event codes.

## 14. Security Trade-offs

This variant is operationally simpler than Cloudflare Access plus Ed25519, but
the accepted trade-offs are:

- possession of a Tenant token grants the caller the Agent API capability until
  rotation;
- the Agent has no independent Cloudflare Access identity check;
- requests do not carry per-request public-key signatures;
- a stolen Bearer token can be replayed, although operation binding prevents an
  identical mutation operation from executing twice; and
- compromise of both the central registry data and its KEK exposes all
  per-Tenant Bearer tokens.

Mitigations are per-Tenant isolation, high-entropy credentials, encryption at
rest, exact destinations, TLS-only transport, rate limits, strict schemas,
idempotency, credential fencing, append-only audit, prompt deactivation, and
immediate token rotation.

This design does not claim Bearer-only authentication is cryptographically
equivalent to the original two-layer design.

## 15. Verification

Focused automated tests must prove:

1. exact valid Bearer requests succeed;
2. missing, wrong, malformed, duplicate, mixed-case, and oversized credentials
   fail before operation parsing or persistence;
3. missing or malformed expected secret configuration fails closed with `503`;
4. comparison uses fixed-length digests and constant-work comparison;
5. Tenant A's token cannot authorize Tenant B;
6. encrypted tokens cannot be moved across Tenant, token-version, or
   KEK-version bindings;
7. Browser/API projections never expose token storage fields;
8. unsafe Agent origins and redirects are rejected;
9. request bodies, responses, and error messages remain bounded and strict;
10. rate limiting applies before provider work;
11. double-clicks, exact retries, conflicting UUID reuse, provider ambiguity,
    quarantine, and reconciliation retain the approved behavior;
12. token rotation failure leaves the Tenant inactive;
13. temporary passwords do not enter persistence, URLs, logs, audit, analytics,
    or client storage;
14. all user lifecycle and forced-password-change scenarios still pass; and
15. every response has the required no-store and hardening headers.

Before completion, both repositories require their focused tests, full lint,
full test suite, production build, desktop/mobile UI inspection, browser
network inspection, security matrix, and a staging lifecycle covering at least
two Tenants with different tokens.

## 16. Acceptance Criteria

The Bearer variant is ready only when:

- only the exact authorized central administrator can load or call the `webook`
  management surface;
- every active Tenant has a unique valid token;
- adding a Tenant does not build or deploy `webook`;
- the Browser never receives any Agent credential or destination;
- token plaintext exists only in provisioning input, bounded server memory, and
  the target Worker secret store;
- token-at-rest encryption is Tenant-bound and versioned;
- the Agent rejects all unauthenticated requests before operation work;
- cross-Tenant token use fails;
- mutations remain idempotent and ambiguous outcomes never auto-replay;
- one-time passwords remain non-recoverable and non-persistent;
- immediate rotation keeps the Tenant inactive until the new pairing verifies;
- all no-store, validation, rate-limit, SSRF, audit, and secret-leakage tests
  pass; and
- full verification and staging rollout pass in both repositories.

## 17. Out of Scope

- Running Bearer and Cloudflare Access/Ed25519 modes simultaneously.
- A shared token for multiple Tenants.
- Tenant-managed token creation or rotation.
- Browser token entry or display.
- Permanent user deletion.
- Automatic replay of ambiguous mutations.
- Zero-downtime old/new token overlap.
- Moving target Supabase secrets into `webook`.
- Rebuilding or deploying `webook` when adding a Tenant.
