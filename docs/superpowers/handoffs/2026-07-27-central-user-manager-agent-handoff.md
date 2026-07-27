# Central User Manager — Agent Handoff

เอกสารนี้คือ entry point สำหรับ agent ใหม่ที่จะรับช่วงออกแบบ/พัฒนา Central User Manager ของภู อ่านไฟล์นี้จนจบ แล้วอ่าน canonical artifacts ทั้ง 3 ไฟล์ตามลำดับก่อนแก้โค้ด ห้ามย้อนกลับไปถามการตัดสินใจที่ระบุว่าอนุมัติแล้ว เว้นแต่พบหลักฐานใหม่ที่ทำให้เกิดความเสี่ยงจริง

## 1. Mission

สร้าง Central User Manager ระยะยาวสำหรับระบบหลายลูกค้า:

- `webook` เป็น UI และ Control Plane กลาง
- `baan-pool-villa` แต่ละ deployment เป็นระบบของผู้ประกอบการ 1 ราย
- ผู้ประกอบการหนึ่งรายมีผู้ใช้แอดมินได้หลายคน
- รองรับประมาณ 20–100 ผู้ประกอบการ
- Cloudflare Workers และ Supabase Projects ทั้งหมดอยู่ในบัญชีของภู
- ลูกค้าเพิ่มผู้ใช้เองไม่ได้
- ผู้ดูแลกลางของภูสร้าง/จัดการเฉพาะแอดมินของ `baan-pool-villa`

ผลลัพธ์สำคัญ: เพิ่มลูกค้าใหม่แล้ว deploy เฉพาะ target `baan-pool-villa` ของลูกค้านั้นและลงทะเบียนในฐานข้อมูลกลาง ไม่ rebuild/deploy `webook`.

## 2. Owner Context

- เรียกผู้ใช้ว่า “ภู”
- ภาษาไทยเป็นหลัก; English technical terms ใช้ได้ แต่อธิบายเมื่อไม่ทั่วไป
- เขตเวลา `Asia/Bangkok`
- Full-Stack Developer ระดับเริ่มต้น–กลาง
- ให้คำตอบหลักก่อน เหตุผล/ขั้นตอนตามหลัง
- เน้น production safety, multi-user behavior และ web security
- ห้าม commit จนภูสั่งชัดเจน
- ห้ามพิมพ์ secret หรือค่า env จริงในคำตอบ/log

## 3. Current Status — 2026-07-27

ยังไม่มี Central User Manager implementation.

งานที่ทำแล้ว:

1. สำรวจ `baan-pool-villa`
2. สำรวจ `webook`
3. ตัดสินใจ architecture/security
4. เขียน design spec
5. ภูอนุมัติสเปก
6. เขียน Tenant Agent implementation plan
7. เขียน Control Plane implementation plan
8. ตรวจ requirement coverage และ cross-contract

ยังไม่ได้ทำ:

- ไม่แก้ application source
- ไม่สร้าง migration
- ไม่แก้ Supabase live project
- ไม่แก้ Cloudflare Access/Worker secrets
- ไม่ deploy
- ไม่ commit/push/PR

### baan-pool-villa workspace

```text
Path: C:\Projects\baan-pool-villa
Branch: refactor/site_settings
HEAD: 93a160cd590fbe1ed9ae2cda96980f5604a6bd61
Status: clean
Latest commit: feat: update NEXT_PUBLIC_SITE_URL to point to the new domain
```

ตอนเริ่มสำรวจ `wrangler.jsonc` เคยมีการแก้ค้างอยู่ แต่ระหว่างสร้าง handoff repo เดินหน้าจาก `55c6276` ไป `93a160c` และการแก้นั้นถูก commit แล้วจากภายนอก task นี้. ต้อง preserve commit ล่าสุด ตรวจสถานะใหม่ก่อนเริ่ม และห้ามย้อน/overwrite การตั้งค่าโดเมนใหม่.

### webook inspection checkout

```text
Repository: https://github.com/Chaimanat2546/webook
Inspected path: C:\Users\USER\AppData\Local\Temp\webook-codex-inspect-20260727
Branch: main
HEAD: 7f33b9cc55a553377200317bc73021d43337c3c8
Status: clean
```

สำเนานี้ใช้สำรวจเท่านั้นและไม่ใช่ implementation target. ก่อนทำ Control Plane ต้องมี writable checkout ของ `webook` และอ่าน `AGENTS.md` ของ repo นั้นใหม่.

## 4. Canonical Artifacts

อ่านตามลำดับ:

1. `C:\Projects\baan-pool-villa\docs\superpowers\specs\2026-07-27-central-user-manager-design.md`
2. `C:\Projects\baan-pool-villa\docs\superpowers\plans\2026-07-27-central-user-manager-tenant-agent.md`
3. `C:\Projects\baan-pool-villa\docs\superpowers\plans\2026-07-27-central-user-manager-control-plane.md`

Hashes ณ เวลาส่งมอบ:

```text
30FFA35B1F6F70A4C5EA767F3B89F32F61D47AFC46BAFC9A97FFB28DA057602D  2026-07-27-central-user-manager-design.md
E4481EA9FC84789616929E0868A71B26008F972E5DE8D276B5B3132E8B74A095  2026-07-27-central-user-manager-tenant-agent.md
8D7868E0262AB3B06B60136E33E4DA89FBF3CDD483012936B19EA1B5C9558B18  2026-07-27-central-user-manager-control-plane.md
```

ทั้ง `docs/superpowers` ถูก ignore โดย `.gitignore:9`. ไฟล์อยู่ใน workspace แต่จะไม่เข้า commit จนกว่าจะเปลี่ยน ignore rule หรือ force-add โดยได้รับอนุญาต.

Canonical priority:

1. คำสั่งล่าสุดของภู
2. `AGENTS.md` ของ repo ที่กำลังแก้
3. approved design spec
4. implementation plan ของ repo นั้น
5. handoff นี้

หาก handoff ย่อความจนคลุมเครือ ให้ยึด spec/plan ฉบับเต็ม.

## 5. Approved Product Decisions

ตัดสินใจแล้ว ห้ามเปลี่ยนเอง:

- จัดการเฉพาะแอดมินของ `baan-pool-villa`
- `webook` เป็น UI กลาง
- ลูกค้าไม่มีหน้าสร้าง user เอง
- สร้าง user โดยตรง ไม่ใช้ invite
- ตอนสร้างเก็บข้อมูล business profile เพียง email ตาม schema ปัจจุบัน
- Agent สร้าง temporary password
- Temporary password ไม่มี time-based expiry
- ผู้ดูแลกลางนำ temporary password ไปแจ้งผู้ใช้เอง
- ผู้ดูแลกลางออก temporary password ใหม่ได้ตลอด
- Temporary password แสดงครั้งเดียวและกู้ค่าเดิมกลับมาไม่ได้
- ถ้าผลตอบกลับหาย ให้ทำ reissue ใหม่
- ไม่มี permanent delete
- มี suspend และ reactivate
- Reactivate ต้องสร้าง temporary password ใหม่เสมอ
- ผู้ใช้ต้องเปลี่ยน temporary password ก่อนใช้ admin functions
- OTP password recovery เดิมยังอยู่
- ไม่เปิด Supabase project-wide require-current-password
- ไม่ใช้ Service Bindings เพราะเพิ่ม tenant แล้วต้องแก้ static binding/redeploy webook
- ไม่ migrate ไป Workers for Platforms ใน MVP
- ไม่ใช้ Supabase Management API ใน request runtime
- ไม่ใช้ Queue/Durable Objects ใน MVP
- ไม่แก้ existing `webook.public.users` RLS ตามคำสั่งภู

## 6. Central Administrator Authorization

Current webook Supabase project ref:

```text
rqizfiayvcbozlzuvbok
```

Project ref ไม่ใช่ secret แต่ต้อง verify ก่อน apply migration/live change.

ผู้จัดการ Central User Manager ต้องตรงทุกข้อ:

1. มี current Supabase Auth user
2. `public.users.uid` ตรงกับ Auth user ID แบบ exact
3. พบ row เดียวเท่านั้น
4. `public.users.role_id = 1`

Role 1 label ปัจจุบัน:

```json
{
  "en": "Administrator",
  "th": "ผู้ดูแลระบบ"
}
```

Authorization ใช้ `role_id = 1` ไม่ใช้ localized label.

ห้าม:

- ใช้ email fallback ของ generic `requireAdmin()`
- ใช้ username
- ใช้ `mid`
- เชื่อ existing broad RLS

วิธีที่อนุมัติ:

- SSR Supabase client ใช้ `auth.getUser()` หา current Auth UID
- webook service-role client query `public.users` ด้วย exact UID + role 1
- zero/multiple/error = deny
- page และทุก API route guard ซ้ำ
- generic webook auth behavior อื่นคงเดิม

Approved risk: production `public.users` RLS มีการอ่านกว้างเกินไปและอาจเปิด email/tel/legacy password field. ภูสั่ง “ไม่แก้”. งานนี้ห้ามแก้ policy/grant ของตารางเดิม และห้ามพึ่ง policy นั้นในการ authorize Central User Manager.

## 7. Architecture

```text
Browser
  |
  | webook session; exact UID + role_id=1
  v
webook Central Control Plane
  - customer project registry
  - central operation idempotency
  - append-only audit
  - Cloudflare Access client secret
  - Ed25519 private signing key
  - NO target Supabase keys
  |
  | exact registry origin
  | Cloudflare Access service token
  | Ed25519 signed request
  v
baan-pool-villa Tenant Agent
  - exact tenant/project identity
  - own sb_secret_... only
  - operation + lock state machine
  - Supabase Auth Admin API
  - public.admin_users
  |
  v
One customer Supabase project
```

Trust boundaries:

- Browser ส่งได้เฉพาะ tenant UUID, operation UUID, action และ strict payload
- Browser ห้ามส่ง Agent URL, Supabase project ref, actor UID, key หรือ request hash
- webook resolve origin/ref/version จาก server-owned registry
- webook ไม่ถือ target Supabase key
- Tenant Agent ไม่ถือ webook database key
- Provisioning machine ถือ Cloudflare/Supabase management credentials ชั่วคราว; runtime ไม่ถือ

## 8. Tenant Agent Endpoints

Exact paths:

```text
GET  /api/internal/central-user-manager/v1/health
POST /api/internal/central-user-manager/v1/operations
```

Supported actions:

```text
list_users
create_user
reissue_temporary_password
suspend_user
reactivate_user
```

`list_users` page size `1..100`.

ทุก response:

```text
Cache-Control: private, no-store
Pragma: no-cache
X-Content-Type-Options: nosniff
```

ไม่มี redirect. Custom Worker cache ต้อง bypass exact internal paths ก่อน cache read/write.

## 9. Request Authentication Protocol

ใช้ 2 ชั้น:

1. Cloudflare Access service token
2. Ed25519 application signature

### Access request headers

```text
CF-Access-Client-Id
CF-Access-Client-Secret
```

Tenant ตรวจ Access assertion จาก:

```text
Cf-Access-Jwt-Assertion
```

ตรวจ:

- JWT signature ผ่าน Access JWKS
- exact issuer
- configured audience
- expiration / bounded clock skew
- service identity `common_name` เท่ากับ configured client ID
- service-token `sub` ว่างได้

JWKS:

```text
https://<team-name>.cloudflareaccess.com/cdn-cgi/access/certs
```

### CUM signature headers

```text
X-CUM-Version: 1
X-CUM-Key-Id: <active signing key id>
X-CUM-Tenant-Id: <customer_projects.id UUID>
X-CUM-Operation-Id: <browser-generated UUID>
X-CUM-Timestamp: <Unix epoch seconds>
X-CUM-Actor-Uid: <webook Auth UID>
X-CUM-Body-Sha256: <lowercase hex SHA-256 exact body bytes>
X-CUM-Signature: <base64 Ed25519 signature>
```

Canonical bytes, UTF-8, no trailing newline:

```text
CUM1
<UPPERCASE METHOD>
<exact pathname only>
<tenant id>
<operation id>
<timestamp>
<actor uid>
<body sha256>
```

Rules:

- request window ±60 seconds
- body read/hash once as exact bytes before JSON parse
- health body empty
- operation body max 16 KiB
- tenant ID must equal local env
- unknown/retired signing key fails closed
- strict path; no alternate slash
- use Web Crypto standard `Ed25519` and SHA-256
- no new crypto dependency planned

Control Plane Agent fetch:

- `redirect: "error"`
- `cache: "no-store"`
- AbortController timeout default 10 seconds
- target lease default 30 seconds
- provider timeout + 5-second margin < remaining lease
- exact registry HTTPS origin, port 443
- reject credentials/path/query/fragment/localhost/IP/private/link-local
- provisioning verifies deployment owner in Cloudflare account

## 10. Target User Model

Authoritative pairing:

```text
auth.users.id = public.admin_users.user_id
normalized auth email = normalized admin_users.email
```

Add to `public.admin_users`:

```sql
must_change_password boolean not null default false
credential_version integer not null default 1 check (credential_version > 0)
```

Normalize email as `lower(btrim(email))`.

Before unique index:

- fail on case-insensitive duplicates
- fail on blank/invalid legacy records
- never silently merge

Auth `app_metadata` owned keys:

```text
credential_version
bpv_admin_managed=true
bpv_created_operation_id=<operation UUID>  # centrally created accounts only
```

Preserve unrelated metadata and provider/provenance data on update. Legacy backfill sets version 1 and managed flag; it does not invent `bpv_created_operation_id`.

## 11. Credential Fence

Every protected `baan-pool-villa` admin request must verify:

```text
JWT app_metadata.credential_version
  == current Auth user.app_metadata.credential_version
  == public.admin_users.credential_version

is_active == true
must_change_password == false
```

Use:

- `auth.getClaims(token)` for verified JWT claims
- `auth.getUser(token)` for current Auth user
- exact current `admin_users` row

Remove existing 30-second positive auth cache from `lib/admin/home-config-auth.ts`.

Supabase global signout revokes refresh sessions but access JWT may remain valid until expiry. Version mismatch blocks old access JWT immediately at application/RLS boundary.

Update `private.is_home_config_admin()` to require:

- `auth.uid()` exists
- active exact self row
- no forced password change
- JWT credential version equals DB version

Narrow `admin_users` browser SELECT to exact self. Central list uses secret client.

## 12. Operation/Concurrency Model

Central operation UUID generated in browser with `crypto.randomUUID()`. Keep same UUID across double-click/network retries.

Central DB atomically binds:

```text
operation_id
tenant_id
actor_uid
action
normalized target/payload
request_hash
```

Same UUID + changed binding = reject.

Target tables:

```text
public.admin_user_operations
public.admin_user_mutation_locks
```

Operation actor kinds:

```text
central_admin
target_admin
```

Internal action:

```text
complete_password_change
```

Lock key: normalized email.

Lock states:

```text
leased
quarantined
```

Use:

- durable intent before provider call
- renewable lease via compare-and-swap
- durable outcome after definite provider result
- strictly increasing `fence_version`
- lease token stored only as SHA-256 hash
- target DB mutations/stage commits in transactional RPC

Provider timeout or crash after intent without definite outcome:

- quarantine
- return no password
- no automatic mutation replay
- exact retry is reconciliation-only

Quarantine never expires automatically. Reviewed repair atomically transfers same lock to higher fence; never unlock first. Late lower-fence result may produce mismatch/availability denial but cannot authorize.

## 13. Lifecycle Semantics

### List

- Merge Auth users and `admin_users` by exact UID
- Page max 100
- One-sided or version mismatch = abnormal
- Read-only; never repair silently

### Create

Input: email only.

1. normalize email
2. claim operation + email lease
3. prove no Auth/profile conflict
4. persist provider intent
5. generate 20-char cryptographic temporary password
6. `auth.admin.createUser` with `email_confirm: true`
7. persist provider outcome
8. insert exact `admin_users` row
9. `is_active=true`
10. `must_change_password=true`
11. version 1
12. complete and return password once

Compensation may delete Auth user only when UID + normalized email + immutable `bpv_created_operation_id` prove this operation created it. Otherwise `needs_review`.

### Reissue temporary password

1. claim operation/lease
2. assign `N+1`
3. DB version `N+1`, force flag true
4. persist intent
5. Auth password + merged metadata version `N+1`
6. transient nonpersistent sign-in with new password
7. assert same UID
8. `auth.admin.signOut(accessToken, "global")`
9. persist outcome
10. complete; return password once

Failure/ambiguity after version advance: keep forced flag, quarantine, no password.

### Suspend

- DB `is_active=false` first
- increment credential version
- Auth ban
- global signout
- DB inactive remains authoritative if provider step fails

### Reactivate

1. DB remains inactive
2. increment version
3. force flag true
4. new temporary password
5. Auth password + metadata + `ban_duration: "none"`
6. transient verify same UID
7. global signout
8. only then DB active true
9. return temporary password once

Never reactivate using old password.

### Forced password change

Route:

```text
/admin/change-password
```

Forced user can access only:

- session-state check
- change-password action
- signout

Form asks:

- current temporary password
- new password
- confirm new password

Acquire email lease before transient temp-password sign-in.

Exact success flow:

1. verify user/profile and claim lease
2. transient verify current temporary password, same UID
3. DB CAS `N → N+1`, flag remains true
4. Auth admin update new password + metadata `N+1`
5. transient sign-in new password, same UID
6. global signout transient token
7. DB CAS `N+1 → N+2`, flag true
8. align Auth metadata `N+2`
9. clear flag only by exact CAS at `N+2`
10. clear browser session
11. require fresh login

Any ambiguity: quarantine and never clear forced flag.

Keep `/admin/reset-password` OTP flow unchanged.

## 14. Password Policy

Current target UI validation in `components/admin/admin-password-validation.ts`:

```text
minimum 8
maximum 128
printable ASCII, no whitespace
at least one lowercase
at least one uppercase
at least one digit
at least one symbol
```

Generated temporary password: 20 chars, cryptographic random, rejection sampling, never `Math.random()`.

Provision/read back Supabase Auth config:

```text
disable_signup=true
external_anonymous_users_enabled=false
password_min_length=8
password_required_characters=abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\:"|<>?,./`~
password_hibp_enabled=<actual selected project value>
security_update_password_require_reauthentication=false
```

HIBP protection is plan-dependent; record actual selected value in attestation. Do not claim enabled without live readback.

## 15. Central Database

New server-only tables:

```text
public.customer_projects
public.user_management_operations
public.central_user_audit_events
```

All:

- enable RLS
- revoke from `anon, authenticated`
- service-role only
- explicit grants

`customer_projects` stores:

- tenant UUID
- display name
- target Supabase project ref
- exact Agent origin
- Wrangler environment
- active flag
- expected Agent/schema versions
- Auth attestation version/digest/check time
- safe health state

Never stores target secret.

`user_management_operations` stores:

- operation UUID
- tenant
- actor UID
- action
- normalized target email
- request hash
- safe status/stage/error
- timestamps/attempt count

Never stores password.

`central_user_audit_events`:

- append-only
- actor/action/tenant/operation/result
- safe details only
- no raw request/response
- no secret/password/token

## 16. webook UI

URL:

```text
/admin/user-manager
```

Filesystem:

```text
app/admin/user-manager/page.tsx
```

Layout:

- desktop: project list | user table/editor | health/operation status
- mobile: stacked
- compact Modern SaaS/Clean Card
- reuse current shadcn/radix UI

Project status shows:

- display name
- active/health
- Agent version
- schema version
- Auth attestation

User columns:

```text
Email
สถานะ
สร้างเมื่อ
เข้าสู่ระบบล่าสุด
การจัดการ
```

Exact Thai statuses:

```text
รอเปลี่ยนรหัส
ใช้งาน
ระงับ
ข้อมูลผิดปกติ
```

Actions:

```text
สร้างผู้ใช้ (email only)
ออกรหัสผ่านชั่วคราวใหม่
ระงับ
เปิดใช้งานและออกรหัสผ่านใหม่
ตรวจสอบสถานะ
```

No edit/delete/invite.

One-time password dialog:

- keep password in React memory only
- never toast/URL/storage/analytics/log
- show email + password + Copy
- warn shown once
- clear state on close
- lost response/closed dialog => reissue

Quarantine:

- disable all mutations
- show operation ID/stage/safe reason
- allow exact read-only `ตรวจสอบสถานะ`

## 17. Provisioning Plane

Provisioning credentials live only on operator machine:

```text
SUPABASE_ACCESS_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SUPABASE_SERVICE_ROLE_KEY  # webook registry only
```

Flow:

1. validate exact tenant/project/origin/Wrangler env
2. Supabase Management API PATCH auth config
3. GET readback
4. calculate versioned timestamped digest binding project ref + normalized settings + policy version
5. create/verify Cloudflare Access app and service-auth policy
6. ensure service token accepted
7. configure target secrets/nonsecret attestation
8. deploy target Wrangler environment only
9. register central project inactive
10. signed health
11. compare tenant/project/Agent/schema/attestation
12. signed `list_users`
13. activate registry row

CLI defaults to dry-run; `--apply` explicit.

Failure:

- leave project inactive
- audit safe failure
- do not blindly roll back proven external state

Adding a tenant does not deploy webook because registry is data-driven and Agent destination is resolved at runtime.

## 18. Rollout Order Per Tenant

1. Prepare migration
2. Deploy Agent disabled:

```text
CENTRAL_USER_MANAGER_AGENT_ENABLED=false
CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED=false
```

3. Preflight normalized emails/Auth-profile pairs
4. Backfill legacy Auth app metadata version 1
5. Verify every active admin exact match
6. Enforcement migration
7. Enable credential fence
8. Existing admins sign in again
9. Test target admin
10. Enable Agent
11. Register inactive in webook
12. Health/list
13. Activate

Never enforce fence before Auth metadata backfill.

Roll out one tenant at a time.

## 19. Existing baan-pool-villa Evidence

Versions:

```text
Next.js ^16.2.9
React ^19.2.7
@supabase/supabase-js ^2.108.2
Vitest ^4.1.9
Wrangler ^4.102.0
@opennextjs/cloudflare ^1.19.11
```

Commands:

```text
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd test -- <path>
```

Relevant files:

```text
AGENTS.md
docs/ai/structure.html
wrangler.jsonc
worker.js
worker-calendar-access.js
.env.example
lib/admin/home-config-auth.ts
lib/admin/route-helpers.ts
components/admin/admin-auth.ts
components/admin/admin-api-client.ts
components/admin/admin-password-validation.ts
components/admin/layout/admin-shell.tsx
components/admin/layout/admin-nav.ts
app/(admin)/admin/layout.tsx
app/(admin)/admin/login/page.tsx
app/(admin)/admin/reset-password/page.tsx
supabase/migrations/20260527000000_create_home_section_config.sql
supabase/site-settings-migrations/20260623000000_bootstrap_site_settings_project.sql
```

Facts:

- `lib/admin/home-config-auth.ts` uses `auth.getUser`
- queries active `admin_users`
- caches positive auth result 30 seconds
- cache must be removed
- `admin_users`: `user_id`, `email`, `role='admin'`, `is_active`, timestamps
- current `private.is_home_config_admin()` checks UID/role/active only
- current admin SELECT lets admins read other admin rows
- enforcement must narrow exact self
- current public/regular Supabase client uses publishable key
- new Tenant Agent needs server-only `SUPABASE_SECRET_KEY`
- target has no `supabase/config.toml` found
- `worker.js` has custom cache/routing; internal paths must bypass
- `docs/ai/structure.html` must update

Wrangler environments:

```text
baanparty -> baan-pool-villa
baan02 -> baan-pool-villa02
baanPMhee -> baan-pool-villa03
```

Preserve latest committed `wrangler.jsonc` and re-check worktree immediately before editing.

Read local Next.js docs before route code:

```text
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
node_modules/next/dist/docs/01-app/02-guides/forms.md
```

## 20. Existing webook Evidence

Versions:

```text
Next.js 16.2.9
React 19.2.4
@supabase/supabase-js ^2.108.2
@supabase/ssr ^0.12.0
Wrangler ^4.105.0
Supabase CLI ^2.108.0
shadcn/radix/lucide/sonner available
Node test runner
```

Commands:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run verify
npm.cmd run build
```

Relevant files:

```text
AGENTS.md
server/auth/admin.ts
server/repositories/admin-users.ts
lib/supabase/server.ts
lib/supabase/admin.ts
lib/env.ts
app/admin/layout.tsx
components/layout/admin-shell.tsx
components/layout/admin-desktop-sidebar.tsx
.env.example
wrangler.jsonc
supabase/migrations/20260626050000_remote_public_schema.sql
README.md
docs/architecture.md
docs/api.md
```

Facts:

- no `app/api` routes currently
- Server Components + Server Actions used
- `requireAdmin()` gets Auth user
- `findAdminUserByAuthIdentity()` tries UID then legacy email fallback
- `canManageHouseRating()` already uses `role_id===1`
- Central capability must be separate/exact; do not alter legacy auth for unrelated pages
- `createSupabaseAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY`
- new central tables can use existing webook service-role key
- admin layout calls generic `requireAdmin`
- sidebar currently houses/ads/quotations
- components exist: `Badge`, `Alert`, `Card`, `Table`, `Sidebar`, `Input`, `Dialog`
- no `jose` dependency; no new dependency required
- webook `AGENTS.md` requires explorer/reviewer subagents for implementation
- webook `AGENTS.md` forbids dependency install without user approval

New migration command:

```text
npx.cmd --no-install supabase migration new central_user_manager_control_plane
```

## 21. Proposed Server-Only Env Names

Tenant:

```text
CENTRAL_USER_MANAGER_AGENT_ENABLED
CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED
CENTRAL_USER_MANAGER_TENANT_ID
CENTRAL_USER_MANAGER_PROJECT_REF
CENTRAL_USER_MANAGER_AGENT_VERSION
CENTRAL_USER_MANAGER_SCHEMA_VERSION
CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION
CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST
CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT
CENTRAL_USER_MANAGER_ACCESS_TEAM_DOMAIN
CENTRAL_USER_MANAGER_ACCESS_AUD
CENTRAL_USER_MANAGER_ACCESS_CLIENT_ID
CENTRAL_USER_MANAGER_SIGNING_KEYS_JSON
SUPABASE_SECRET_KEY
```

webook:

```text
CENTRAL_USER_MANAGER_ACCESS_CLIENT_ID
CENTRAL_USER_MANAGER_ACCESS_CLIENT_SECRET
CENTRAL_USER_MANAGER_SIGNING_KEY_ID
CENTRAL_USER_MANAGER_SIGNING_PRIVATE_KEY_PKCS8_BASE64
CENTRAL_USER_MANAGER_PROTOCOL_VERSION=1
CENTRAL_USER_MANAGER_AGENT_TIMEOUT_MS
SUPABASE_SERVICE_ROLE_KEY
```

Never prefix secrets with `NEXT_PUBLIC_`.

## 22. Database/Migration Rules

- Migrations are source-controlled schema history
- Never edit old migration
- Use Supabase CLI; never invent timestamp
- Existing online projects get minimal idempotent patch SQL
- No seed rerun
- No unsafe full delete
- No direct mutation of `auth.users` SQL
- Auth operations through Supabase Admin API
- privileged logic in `private`
- narrow `public` invoker wrappers
- `SECURITY DEFINER`
- fixed safe `search_path`
- explicit grants/revokes
- `notify pgrst, 'reload schema'`
- new public tables RLS enabled
- revoke `anon, authenticated`
- source/SQL contract tests

Target likely needs two migrations:

```text
prepare_central_user_manager_agent
enforce_admin_credential_fence
```

Use:

```text
supabase migration new prepare_central_user_manager_agent
supabase migration new enforce_admin_credential_fence
```

Do not use `supabase db reset` on populated remote projects.

## 23. Security Non-Negotiables

- no target key in webook
- no service-role/secret in browser
- no password persistence
- no password log
- no raw provider response in UI
- no token/signature log
- no dynamic browser-supplied outbound URL
- exact HTTPS origin
- no redirect
- strict request/response schemas
- bounded request/response sizes
- cryptographic random only
- exact UID checks
- version fence on every protected request
- fail closed
- one-sided Auth/profile = `needs_review`
- ambiguous provider mutation = quarantine
- no auto unlock/retry
- no permanent delete
- no mutation from health/reconcile
- no broad path revalidation/cache writes

## 24. Implementation Order

Recommended:

1. Obtain explicit implementation instruction fromภู
2. Read target `AGENTS.md`, full spec, Tenant plan
3. Use required skills:
   - Supabase
   - Cloudflare/Workers
   - test-driven-development
   - subagent-driven-development or executing-plans
4. Preserve dirty worktree
5. Implement Tenant Agent Tasks 1–17 incrementally
6. Verify unit/integration/build/UI
7. Stage one nonproduction tenant
8. Obtain writable webook checkout
9. Read webook `AGENTS.md`, full spec, Control plan
10. Spawn required explorer/reviewer subagents
11. Implement Control Plane Tasks 1–15
12. End-to-end staging/fault injection
13. Provision tenant one at a time
14. Stop commit-ready; do not commit withoutภู instruction

Do not start webook production activation before Tenant Agent is proven.

## 25. Verification Gates

Target:

```text
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

webook:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

UI inspect desktop + mobile.

Required states:

- loading
- empty
- error
- long email/project name
- healthy/unhealthy/inactive tenant
- forced/active/suspended/abnormal user
- one-time password
- quarantine/reconcile

Staging lifecycle:

1. list
2. create
3. lose/close password response
4. reissue
5. forced change
6. fresh login required
7. old-session denial
8. suspend
9. reactivate/new password
10. exact retry
11. concurrent mutation
12. provider timeout
13. quarantine
14. reviewed reconcile

Production network checks:

- internal responses no-store
- no cache writes
- no unexpected `_rsc`
- no public `/_next/image` caused by this feature
- target origin/ref/key absent from browser/RSC payload
- password absent from URL/log/storage

## 26. Known Gaps / Live Inputs Needed

These are not design questions; resolve at execution/provisioning time:

- writable `webook` checkout
- exact first staging tenant selected byภู
- actual target Supabase secret keys
- Cloudflare Access team domain/audience
- Access service token
- Ed25519 key pair/key ID
- actual Supabase Auth config readback
- selected `password_hibp_enabled` per project/plan
- Cloudflare/Supabase management tokens for provisioning
- whether ignored design/plan/handoff docs should be added to Git

Never request or paste secret values into chat if CLI/secret tooling can set them directly.

Live mutations require scope confirmation for exact tenant/project/environment. Prior design approval is not blanket permission to mutate every live project.

## 27. Official References Checked

```text
https://supabase.com/docs/guides/auth/password-security
https://supabase.com/docs/reference/api/introduction
https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
```

Recheck current official API schemas immediately before provisioning code because Management/Cloudflare APIs can change.

## 28. First Message for New Agent

เมื่อรับงาน ให้ตอบภูสั้น ๆ ว่า:

1. อ่าน handoff, approved spec และ implementation plan ของ repo ที่จะเริ่มแล้ว
2. ยืนยันว่า Central User Manager ยังไม่ถูก implement
3. ยืนยันว่าจะ preserve `wrangler.jsonc`
4. บอก Task แรกที่จะทำ
5. เริ่มตาม plan โดยไม่ออกแบบใหม่

หากภูสั่ง “เริ่มทำ” โดยไม่ระบุฝั่ง ให้เริ่ม Tenant Agent plan ก่อน.
