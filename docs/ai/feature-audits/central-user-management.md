# Central User Management

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้จัดการ lifecycle ของผู้ดูแลผ่าน private Worker/RPC: list, create, reissue temporary password, suspend และ reactivate user. Public requests ถูกบล็อกก่อนถึง Next/Supabase; mutation มี state machine, operation fencing, provider event journal และ safe result projection

## จุดที่ทำได้ดี

- public legacy paths และ private bridge ถูก Worker ตอบ empty `404` ก่อนถึง OpenNext, cache, rate limiter หรือ Supabase
- private named entrypoint เป็นช่องทางเดียวที่เข้าถึง bridge ได้
- RPC request validate exact protocol-v1 shape, canonical UUID, payload และ canonical hash
- Tenant identity ถูกตรวจสอบก่อนสร้าง privileged context
- mutations ใช้ Auth Admin API, provider intent/outcome journal, operation fence และ durable recovery
- safe projection จำกัด response และ temporary password อยู่เฉพาะ request-local result
- tests ผ่าน 29 test files, 282 tests และ TypeScript owner check ผ่าน

## รายการที่ควรปรับในอนาคต

### 1. แยก `operation-service.ts` ตาม action และ recovery flow

ไฟล์รวม create/reissue/suspend/reactivate, provider calls, fencing, recovery และ quarantine ควรแยก action handlers กับ state-machine/recovery owner เพื่อให้แก้ lifecycle หนึ่งโดยไม่เสี่ยงอีก lifecycle

### 2. ทำ operation/state transition map

บันทึก transition ที่อนุญาต, provider intent/outcome, compensation, retry, quarantine และ terminal states ของแต่ละ action ในรูปแบบเดียวกับ migration/test เพื่อให้คนแก้ตามได้ง่าย

### 3. จัดการ contract ซ้ำระหว่าง internal และ RPC protocol

`contracts.ts` กับ `rpc-contract.ts` มี action/payload validation ที่คล้ายกันแต่มี boundary ต่างกัน ควรระบุความสัมพันธ์และ share เฉพาะ primitives ที่เหมาะสม เพื่อป้องกัน action หรือ payload drift ระหว่างสอง contract

### 4. ทำ protocol-version upgrade playbook

RPC strict ที่ version 1 ซึ่งดี ควรบันทึกขั้นตอนเพิ่ม V2, compatibility window, canonical hash migration และเงื่อนไขถอน V1 ก่อนมีการเปลี่ยน protocol จริง

### 5. ทำ operator UX สำหรับ `needs_review` และ `quarantined`

State เหล่านี้ปลอดภัย แต่ต้องมี runbook หรือหน้าสรุปที่บอกว่าผู้ปฏิบัติการเห็นอะไร, retry ได้เมื่อไร, ใครอนุมัติ และห้ามทำอะไร เพื่อไม่ให้แก้ข้อมูลด้วยมือจนทำลาย fence

### 6. ทำ audit trail ที่ค้นหาได้

มี durable operation/provider event อยู่แล้ว ควรกำหนด projection สำหรับ operator เช่น actor, target, action, status, เวลา, error class และ correlation id โดยไม่เผย temporary password/token/provider payload

### 7. กำหนด lifecycle ของ temporary password

แม้ระบบออกแบบให้ password อยู่ request-local ควรกำหนดฝั่งผู้เรียกว่าจะส่งต่อหรือแสดงผลครั้งเดียวอย่างไร, acknowledgement แบบใด, ห้าม log/analytics ที่ใด และวิธี reissue ที่ปลอดภัยหากผู้รับทำหาย

### 8. ทำ quota และ caller policy ของ private entrypoint

ควรระบุว่า Service Binding/caller ใดเรียกได้, มี quota/concurrency/timeout ต่อ Tenant อย่างไร และควร alert เมื่อ mutation rate ผิดปกติ

### 9. รวม migration history เป็น lifecycle ledger

มี migration-contract tests หลายรอบสำหรับ credential fence และ backfill ควรมีเอกสารสรุป schema version, migration ที่ต้องมี, verification query และ rollback/recovery ที่ปลอดภัย โดยไม่ลบประวัติ migration เดิม

### 10. เพิ่ม failure-injection integration test

เพิ่ม scenario provider สำเร็จแต่ DB ล้มเหลว, timeout หลัง intent, retry operation เดิม, duplicate email และ reactivation หลัง suspend เพื่อยืนยันว่าผลลัพธ์ปลอดภัยตลอด boundary จริง

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/central-user-manager/__tests__ worker-central-user-manager.test.ts "app/(admin)/api/%5Fworker/central-user-manager/route.test.ts"`

ผลลัพธ์: ผ่าน 29 test files, 282 tests

`npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false`

ผลลัพธ์: ผ่าน
