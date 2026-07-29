# คู่มือ Provisioning Tenant สำหรับ Central User Manager

เอกสารนี้เป็น runbook สำหรับ operator ของ `webook` และ Tenant Agent ใน
`baan-pool-villa` เท่านั้น การทำงานจริงต้องใช้ change approval ของแต่ละ
environment และต้องเก็บ Tenant เป็น `inactive` จนกว่าทุก gate จะผ่าน

## สถาปัตยกรรมและขอบเขตความลับ

`webook` เรียก Tenant Agent ด้วย HTTP `Authorization: Bearer ...` แบบเดียวกับ
การเรียก API ด้วย Bearer ทั่วไป ความแตกต่างคือแต่ละ Tenant มี Bearer เฉพาะของ
ตัวเอง: `webook` ส่ง dedicated Bearer ของ Tenant เป้าหมาย และ Worker ของ Tenant
เก็บค่าที่คาดไว้เพื่อเปรียบเทียบ จึงแยกผลกระทบของ secret ต่อ Tenant ไม่ใช้
token กลางร่วมกัน

Bearer ต้องถูกสร้างใน provisioning orchestration ด้วย cryptographic RNG เป็น
ค่า 256-bit (32 bytes) แล้วเข้ารหัส canonical unpadded base64url ห้ามใช้
`Math.random()` และ helper ใน repo นี้มีหน้าที่ validate เท่านั้น ไม่ generate
หรืออ่าน token จาก command-line argument, URL, file หรือ public environment

มี Bearer อยู่เพียงสองสำเนา:

1. central secret vault ของ `webook`;
2. Cloudflare Worker secret ชื่อ `CENTRAL_USER_MANAGER_BEARER_TOKEN` ของ Tenant
   นั้น

ห้ามเก็บค่า secret ใน source, Git, database rows, browser, เอกสาร, ticket,
clipboard history, logs หรือค่าที่ขึ้นต้น `NEXT_PUBLIC_*` และห้ามบันทึก hash
เพื่อใช้แสดงแทน token ด้วย ส่วน `SUPABASE_SECRET_KEY`, Cloudflare Access
Service Client Secret และ Management API credential เป็น server/provisioning
secret ที่ต้องแยกขอบเขตตามหน้าที่เช่นกัน

การเพิ่ม Tenant ไม่ต้อง redeploy แอป `webook` หรือ Tenant เดิม แต่ environment
และ Worker ของ Tenant ใหม่ต้อง configure และ deploy ครั้งแรกหนึ่งครั้งใน
initial install หลังจากนั้น registry ของ `webook` จึงชี้ไปยัง endpoint ใหม่นี้ได้

## Initial install

ทำตามลำดับและหยุดทันทีเมื่อขั้นใดล้มเหลว:

1. สร้าง registry record เป็น `inactive` พร้อม canonical Tenant UUID, Supabase
   project ref 20 ตัวอักษร, hostname, expected agent/schema/protocol version
   และ `tokenVersion` ที่เป็นจำนวนเต็มบวก
2. ตั้ง Cloudflare Access application และ Service Auth policy ให้ป้องกันเฉพาะ
   สอง path นี้:
   - `/api/internal/central-user-manager/v1/health`
   - `/api/internal/central-user-manager/v1/operations`
3. ตั้ง nonsecret Worker vars ให้ครบ:
   `CENTRAL_USER_MANAGER_AGENT_ENABLED=false`,
   `CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED=false`,
   `CENTRAL_USER_MANAGER_TENANT_ID`, `CENTRAL_USER_MANAGER_PROJECT_REF`,
   `CENTRAL_USER_MANAGER_AGENT_VERSION`, `CENTRAL_USER_MANAGER_SCHEMA_VERSION`,
   `CENTRAL_USER_MANAGER_TOKEN_VERSION`,
   `CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION`,
   `CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST` และ
   `CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT`
4. สร้าง Bearer 256-bit ด้วย cryptographic RNG ในหน่วยความจำ ตรวจด้วย
   `validate-bearer-token.mjs` แล้วเขียนสองสำเนาลง central secret vault และ
   Worker secret เท่านั้น ตั้ง `SUPABASE_SECRET_KEY` เป็น Worker secret ด้วย
5. เตรียมและตรวจ schema ตามลำดับบังคับ:
   **prepare migrations → dry-run backfill → approved apply + verify →
   enforcement migration → enable credential fence** ห้ามข้ามหรือสลับลำดับ
   และต้อง rerun dry-run backfill จนรายงานสะอาด
6. ใช้ provisioning-only credential อ่าน Supabase Auth configuration จริง
   ตรวจว่า signup ถูก disable, anonymous sign-in ถูก disable และ password
   policy ตรงกับค่าที่อนุมัติ จากนั้นส่งเฉพาะค่าที่ไม่ลับเข้า
   `auth-attestation.mjs` บันทึก `v1`, digest และ checked time ใน registry กับ
   nonsecret Worker vars ห้ามส่ง Management API token หรือ provider error เข้า
   helper
7. deploy Worker ของ Tenant ใหม่โดยทั้งสอง feature flags ยังเป็น `false`
   ตรวจว่า Access ปฏิเสธคำขอที่ไม่มี service credential และ Worker รับเฉพาะ
   exact two paths ข้างต้นโดยไม่ผ่าน public cache
8. เปิด `CENTRAL_USER_MANAGER_AGENT_ENABLED=true` แล้วเรียก health ด้วย Access
   credential และ Bearer ของ Tenant ตรวจ exact Tenant/project/token/version,
   schema/RPC checks, no-store headers และ Auth attestation ให้ตรง registry
9. เปิด `CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED=true` หลัง enforcement
   migration และ health verification เท่านั้น เรียก health ซ้ำ แล้วจึงเปลี่ยน
   registry เป็น `active`

source-controlled migrations ใน branch นี้ยังไม่ได้ apply กับ online project
ใดโดยเอกสารนี้ การ apply ต้องเป็น approved operation แยกต่างหาก

## การหมุน Bearer แบบ single-token

ระบบไม่มี dual-token overlap และไม่มี silent fallback การ rotate จึงมี
immediate single-token rotation downtime ตามลำดับนี้:

1. เปลี่ยน Tenant ใน central registry เป็น `inactive` และหยุดส่ง mutation ใหม่
2. สร้าง Bearer 256-bit ใหม่ด้วย cryptographic RNG และเพิ่ม `tokenVersion`
3. update Worker secret ของ Tenant และ deploy/configure Tenant ให้รับ token ใหม่
4. update สำเนาใน central secret vault ให้ตรงกัน ห้ามเก็บ token เก่าเป็น fallback
5. เรียก health ด้วย token ใหม่ ตรวจ token version, Tenant identity, schema และ
   attestation ให้ครบ
6. เมื่อ health ผ่านเท่านั้นจึงเปลี่ยน Tenant กลับเป็น `active`

provisioning, rotation, Auth attestation หรือ health ใดล้มเหลว ต้องคง Tenant
เป็น `inactive`; อย่าย้อนมาใช้ token เก่าและอย่าเปิดสอง token พร้อมกัน

## Temporary password, quarantine และการซ่อมข้อมูล

temporary password แสดงได้ครั้งเดียวใน successful no-store response เท่านั้น
plaintext ไม่ถูกเก็บและกู้คืนไม่ได้ กรณี lost temporary password response หรือ
operator ปิดหน้าก่อนบันทึก ต้องสร้าง operation ใหม่เพื่อ reissue temporary
password ห้ามอ่านคืนจากฐานข้อมูลหรือ logs

เมื่อ Auth mutation ให้ผลกำกวม เช่น timeout หลังส่งคำขอ ให้คง operation/target
เป็น `quarantine` หรือ review, ปิด mutation เพิ่มเติม และทำ read-only
reconciliation จาก Auth กับ `admin_users` ก่อน ห้าม replay ambiguous Auth
mutation อัตโนมัติ กล่าวคือไม่ replay Auth mutation ที่ยังยืนยันผลไม่ได้
การปลด quarantine ต้องเป็น explicit repair operation ที่มี
fence ใหม่และหลักฐานของผลจริง

ก่อน apply backfill และก่อนเปิด credential fence ให้แก้ทุก category แล้ว rerun
dry-run จน clean:

- `duplicate` UID หรือ duplicate normalized-email: หาผู้ถือ identity ที่ถูกต้อง
  จากหลักฐาน แล้วแก้ conflict โดยไม่ merge อัตโนมัติ
- normalized-email conflict: normalize ด้วย trim/lowercase และยืนยัน owner เพียง
  รายเดียวทั้ง Auth และ profile
- `Auth-only`: ตัดสินใจสร้าง/กู้ profile ที่ตรง UID หรือยกเลิก Auth identity ตาม
  change approval
- `profile-only`: ตัดสินใจสร้าง/กู้ Auth identity ที่ตรง UID หรือปิด profile ตาม
  change approval
- `UID/version mismatch`: ห้ามจับคู่ด้วย email อย่างเดียว ปรับ Auth metadata และ
  database credential version ผ่าน flow ที่มี fence จน UID และ positive safe
  version ตรงกัน

อย่า replay password, ban, delete หรือ metadata mutation ที่ผลยัง ambiguous
หลังซ่อมต้อง rerun dry-run backfill, health และ reconciliation จนไม่มี mismatch

## Rollback และ disable boundary

- ปิด Tenant ใน central registry เพื่อหยุด `webook` ก่อนเสมอ
- ปิด `CENTRAL_USER_MANAGER_AGENT_ENABLED` เพื่อหยุดสอง Agent routes ที่ Tenant
- ปิด Cloudflare Access route/application เพื่อปิด network entry point
- อย่าปิด `CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED` เพื่อข้าม schema หรือ
  identity mismatch; fence เป็น fail-closed authorization boundary
- rollback Worker ต้องใช้ revision ที่ schema/runtime contract เข้ากัน และต้อง
  health-test ก่อน reactivate
- additive migrations และ durable operation evidence ไม่ถูก rollback ด้วยการ
  deploy Worker; ห้ามลบ audit/quarantine state เพื่อทำให้ health ผ่าน

## Validation และ troubleshooting แบบไม่เปิดเผยความลับ

รันเฉพาะการตรวจที่เกี่ยวข้องจาก repo root:

```powershell
npm.cmd test -- tests/central-user-manager-bearer-provisioning.test.ts tests/central-user-manager-auth-attestation.test.ts
npx.cmd eslint scripts/central-user-manager/validate-bearer-token.mjs scripts/central-user-manager/auth-attestation.mjs tests/central-user-manager-bearer-provisioning.test.ts tests/central-user-manager-auth-attestation.test.ts
node --check scripts/central-user-manager/validate-bearer-token.mjs
node --check scripts/central-user-manager/auth-attestation.mjs
```

เมื่อตรวจระบบจริง ให้บันทึกเฉพาะ Tenant ID, project ref, token version, attestation
version/digest/checked time, HTTP status, safe error code และ deployment version
ห้าม paste `Authorization`, Bearer, Access Client Secret, Supabase secret,
Management API token, temporary password หรือ raw provider error ลง terminal
history, CI output, chat หรือ ticket ถ้า token อาจรั่วให้เริ่ม single-token
rotation ทันทีโดย Tenant ยัง `inactive`

แนวทางแยกปัญหา:

- `401`: ตรวจ secret version/mapping โดยไม่พิมพ์ค่า แล้ว rotate หากยืนยันไม่ได้
- `403` จาก Access: ตรวจ service-token policy, audience, hostname และ exact path
- `429`: รอ rate-limit window; ห้าม retry แบบ unbounded
- `503`/health mismatch: คง `inactive`, เทียบ nonsecret version/attestation และ
  schema/RPC health report; ห้าม fallback หรือเปิด fence ก่อนเวลา
- backfill conflict: หยุด apply, ซ่อม category แบบ explicit แล้ว rerun dry-run
