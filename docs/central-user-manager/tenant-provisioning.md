# คู่มือ Provisioning Tenant สำหรับ Central User Manager

เอกสารนี้เป็น runbook สำหรับ operator ของ `webook` และ Tenant Worker ใน
`baan-pool-villa` เท่านั้น ทุกการเปลี่ยนแปลงระบบจริงต้องมี change approval
แยกตาม environment และ Tenant ต้องเป็น `inactive` จนกว่าทุก gate ด้านล่างผ่าน

## ขอบเขต RPC-only

`webook` เรียก Tenant Worker ผ่าน Cloudflare Service Binding ภายใน account เดียวกัน
เท่านั้น โดยเรียก named entrypoint
`CentralUserManagerEntrypoint.executeOperation(input)` ไม่มี public Agent URL,
ไม่มี `Authorization: Bearer`, ไม่มี health runtime และไม่มี compatibility mode

Tenant Worker เปิด public HTTP ได้ตามปกติสำหรับเว็บไซต์ แต่ต้องตอบ empty `404`
แบบเดียวกันกับ path ที่เลิกใช้ทั้งหมด โดยไม่ส่งต่อเข้า OpenNext, cache, rate limiter
หรือ Supabase:

- `/api/internal/central-user-manager/v1/health`
- `/api/internal/central-user-manager/v1/operations`
- `/api/_worker/central-user-manager`

private bridge path สุดท้ายใช้ได้เฉพาะ named entrypoint ภายใน Worker เท่านั้น
และไม่ใช่ endpoint สำหรับ caller อื่น

RPC input มี `protocolVersion: 1`, Tenant UUID, operation UUID, actor UID, action
และ payload ที่ strict. มีเพียงห้างานต่อไปนี้:

- `list_users`
- `create_user`
- `reissue_temporary_password`
- `suspend_user`
- `reactivate_user`

การเพิ่ม Tenant จึงต้องเพิ่ม Service Binding แบบ static ใน `webook` แล้ว redeploy
`webook`; ห้ามแทนที่ binding ด้วย URL หรือ secret fallback. Tenant Worker และ
`webook` ต้องอยู่ Cloudflare account เดียวกัน

## Initial install และ cutover

ทำตามลำดับนี้และหยุดทันทีหากขั้นใดล้มเหลว:

1. สร้าง registry record เป็น `inactive` พร้อม Tenant UUID แบบ canonical และคงค่า
   UUID เดิมตลอดอายุ Tenant. บันทึก project ref และ Worker/binding name ที่ตรวจสอบได้
   โดยไม่เก็บ URL หรือ credential เพื่อใช้เป็นทางเรียก Central User Manager.
2. ตั้ง Tenant Worker ด้วย config ขั้นต่ำ: `CENTRAL_USER_MANAGER_AGENT_ENABLED=false`,
   `CENTRAL_USER_MANAGER_TENANT_ID`, `CENTRAL_USER_MANAGER_PROJECT_REF`,
   `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` ที่ตรง project ref และ server-only
   `SUPABASE_SECRET_KEY`. ห้ามตั้ง Bearer, token version, agent/schema version,
   attestation, credential-fence flag หรือ rate limiter สำหรับ Central User Manager.
3. เตรียมและตรวจ schema ตามลำดับบังคับ:
   **prepare migrations → dry-run backfill → approved apply + verify → enforcement
   migration → enable credential fence**. ห้าม apply กับ project ที่ไม่ได้ระบุชัด
   และ source-controlled migration ไม่ใช่หลักฐานว่า online project ถูกเปลี่ยนแล้ว.
4. deploy Tenant Worker revision ที่มี named entrypoint และ public legacy `404`
   ก่อน (`target-first deploy`). ตรวจ account, Worker name, Tenant UUID และ
   project ref จาก output ที่ redacted; อย่าเรียก public path เพื่อทดสอบสิทธิ์.
5. หลัง enforcement migration ผ่าน ให้ตั้ง
   `CENTRAL_USER_MANAGER_AGENT_ENABLED=true` แล้ว deploy Tenant config. ถ้า config
   ไม่ครบหรือ identity ไม่ตรง ต้อง fail closed และคง Tenant เป็น `inactive`.
6. เพิ่ม binding ของ Tenant Worker ไปยัง named entrypoint ใน `webook` แล้ว deploy
   `webook` revision ที่ตรง environment. ยืนยันว่า binding ชี้ Worker/entrypoint
   ที่กำหนด ไม่ใช่ URL, fetch binding หรือ Bearer secret.
7. ผ่าน `webook` binding เท่านั้น เรียก `list_users` ด้วย Tenant UUID เดิมและ
   ตรวจ reconciled read-only result ที่ปลอดภัย. นี่คือ readiness gate แทน health.
8. สำหรับ Staging ให้ทดสอบผู้ใช้ disposable แยกจากผู้ใช้จริงครบสี่ mutation:
   `create_user`, `reissue_temporary_password`, `suspend_user`, และ
   `reactivate_user`. Temporary password แสดงได้ครั้งเดียว ห้ามบันทึก plaintext.
9. ตรวจ public HTTP ทั้ง legacy paths และ private bridge ว่าตอบ empty `404`
   เหมือนกันแม้ส่ง header หรือ Bearer รูปแบบใดก็ตาม และไม่มี public fallback.
10. เมื่อ readiness และสี่ mutation ผ่าน พร้อมหลักฐานว่าไม่มี in-flight mutation
    ที่ไร้ผลสรุป ให้ลบ retired secrets ตามหัวข้อถัดไปขณะที่ Tenant ยัง `inactive`.
11. ตรวจการลบและ public legacy `404` ซ้ำ แล้วจึงเปลี่ยน registry เป็น `active`
    แบบ atomic.

## Retired secret และ quarantine

หลังผ่าน readiness/mutation gates (steps 7–9) แต่ก่อน registry activation (step 11)
และขณะที่ Tenant ยัง `inactive` ให้ลบค่าที่เลิกใช้จากทุก environment และ secret
store: `CENTRAL_USER_MANAGER_BEARER_TOKEN`,
`CENTRAL_USER_MANAGER_TOKEN_VERSION`, agent/schema version, Auth attestation,
`CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED` และ
`CENTRAL_USER_MANAGER_RATE_LIMITER`. ห้ามเก็บเป็น rollback secret หรือใช้ตรวจ
legacy request. เก็บเฉพาะ secret ที่ยังจำเป็นแก่ Tenant server เช่น
`SUPABASE_SECRET_KEY`.

หาก mutation ของ Auth ให้ผลกำกวม เช่น timeout หลังส่งคำขอ ให้คง Tenant เป็น
`inactive`, quarantine operation/target และทำ read-only reconciliation ระหว่าง
Auth กับ `admin_users` ก่อน ห้าม replay mutation ที่ยังพิสูจน์ผลไม่ได้อัตโนมัติ.
การปลด quarantine ต้องเป็น explicit repair operation ที่มี fence ใหม่และหลักฐาน
ผลจริง. Lost temporary password ต้องใช้ `reissue_temporary_password` operation ใหม่
เท่านั้น

## Rollback และ disable boundary

- เปลี่ยน Tenant เป็น `inactive` และหยุด `webook` dispatch ก่อนเสมอ.
- resolve ทุก in-flight mutation ด้วย proven outcome หรือ explicit quarantine;
  หากทำไม่ได้ให้คง inactive.
- rollback ใช้ได้เฉพาะ Tenant และ `webook` revisions ที่ RPC contract เข้ากัน และ
  ต้อง redeploy ทั้ง binding/caller ตามลำดับที่ตรวจได้.
- ห้าม restore public HTTP Agent routes, Bearer, token rotation, authenticated health
  หรือ fallback ใด ๆ. การ rollback ไม่อนุญาตให้คนนอกเรียก Central User Manager.
- ห้ามลบ audit, fence, lock หรือ quarantine evidence เพื่อให้ readiness ผ่าน.

## Validation และบันทึกหลักฐาน

รันจาก repo root ตามส่วนที่เปลี่ยน:

```powershell
npm.cmd test -- lib/central-user-manager/__tests__ worker-central-user-manager.test.ts "app/(admin)/api/%5Fworker/central-user-manager/route.test.ts"
npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false
npm.cmd run lint
npm.cmd run build
```

เมื่อทดสอบระบบจริง ให้บันทึกเฉพาะ Tenant ID, project ref, Worker/deployment version,
binding/entrypoint name, safe RPC status, redacted operation ID และผล `404`. ห้าม paste
Bearer, `Authorization`, Supabase key, Management API token, database URL/password,
temporary password หรือ raw provider error ลง logs, CI, chat หรือ ticket.

หาก `list_users` หรือ mutation ใดไม่ผ่าน ให้คง Tenant เป็น `inactive`; ตรวจ
Tenant UUID, project ref, Service Binding และ RPC revision โดยไม่สร้าง public
HTTP fallback. หาก public path ไม่คืน empty `404` ให้หยุด rollout และแก้ boundary
ก่อน activate.
