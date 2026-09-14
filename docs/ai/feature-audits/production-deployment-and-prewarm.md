# Production Deployment & Prewarm

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้ดูแล CI production deployment, target configuration validation, migration selection และ post-deploy prewarm. Test migration ถูกแก้ในรอบนี้ให้ไม่ยึดจำนวน migration ตายตัว แต่ยังตรวจ ownership boundary อยู่

## รายการที่ควรปรับในอนาคต

1. ทำ deployment state machine: PR dry-run → deploy → cache/version readiness → prewarm → smoke check → rollback
2. ทำ migration manifest/ownership rule ที่ชัดเจน แยก Tenant, catalog และ migration ที่ห้าม deploy
3. ทำ prewarm result report: URL, status, timeout, cache outcome, retry และ skipped routes
4. แยก deploy validation ออกจาก deploy execution พร้อม environment/approval boundary
5. ทำ rollback runbook สำหรับ Worker version, cache/version token, migration compatibility และ post-rollback verification
6. ทำ config/secret drift report ข้าม production targets โดยไม่แสดง secret values
7. เชื่อม deployment id กับ CI, Worker version, prewarm, smoke test และ logs
8. เพิ่ม failure-path tests สำหรับ owner ผิด, target หาย, deploy fail, prewarm timeout, cache miss และ rollback trigger

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- scripts/production-deploy-config.test.ts scripts/prewarm-public-html.test.ts scripts/production-deploy-workflow.test.ts`

ผลลัพธ์: ผ่าน 3 test files, 30 tests
