# แผนดำเนินการ Migration Gate ของ Supabase สำหรับ Tenant

> สำหรับ agentic worker: ใช้ `superpowers:subagent-driven-development` หรือ `superpowers:executing-plans` และติดตามแต่ละ task ด้วย checkbox

**เป้าหมาย:** เมื่อ source migration เปลี่ยน ให้ apply กับฐานข้อมูล production ของ Tenant ทั้ง 5 ก่อนเริ่ม deploy จาก `master`

**สถาปัตยกรรม:** `wrangler.jsonc` เป็น source of truth ระหว่าง target และ project ref. `verify` ตรวจการเปลี่ยนใต้ `supabase/migrations/**`; ถ้าพบ จะรัน Supabase CLI matrix ทั้ง 5 ก่อน Cloudflare deployment matrix เดิม

**Tech Stack:** GitHub Actions, Supabase CLI 2.x ผ่าน `supabase/setup-cli`, Node.js 24, Vitest, TypeScript JSONC parsing, Wrangler 4

**Spec:** `docs/superpowers/specs/2026-08-28-tenant-supabase-migrations-design.th.md`

## ข้อกำหนดส่วนกลาง

- เขียนฐานข้อมูลอัตโนมัติเฉพาะ push ไป `master` ที่เปลี่ยน `supabase/migrations/**`
- target คือ `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, `villaMedia` เท่านั้น และทุกตัวมี migration history ชุดเดียวกัน
- `wrangler.jsonc` เป็นเจ้าของ `CENTRAL_USER_MANAGER_PROJECT_REF`; ห้ามคัดลอก ref ลง workflow YAML หรือ GitHub variables
- ใช้ `SUPABASE_ACCESS_TOKEN` ระดับ repository/organization และ `SUPABASE_DB_PASSWORD` ระดับ GitHub Environment
- ห้ามเผย database URL, password, token หรือ secret ใน command, fixture, summary, artifact หรือเอกสาร
- migration ล้มเหลวเพียงตัวเดียวต้อง block deployment ทั้งหมด; job ที่ skipped เพราะไม่มี migration เปลี่ยนไม่ block deploy
- pull request ห้ามเขียนฐานข้อมูลและต้องคง Cloudflare dry-run เดิม
- ห้าม apply seed, bootstrap SQL, patch SQL, retry หรือ rollback database โดยอัตโนมัติ
- ห้าม commit, push หรือแก้ GitHub secrets/environments หากไม่ได้รับอนุญาตชัดเจน

## โครงสร้างไฟล์

- `scripts/production-deploy-config.mjs`: ตรวจ project ref และสร้าง matrix target/site URL/project ref
- `scripts/production-deploy-config.test.ts`: test matrix 5 entries และกรณี ref หาย/ผิดรูปแบบ
- `.github/workflows/deploy-production.yml`: detect migration, migrate matrix และ deploy dependency
- `scripts/production-deploy-workflow.test.ts`: static tests ของ gate, secret scope และ command
- `README.md`, `docs/deployment.md`, `docs/ai/structure.html`: คู่มือตั้งค่าและ recovery ที่ไม่มี secret value

### Task 1: เพิ่ม project ref ที่ตรวจแล้วลง matrix

**ไฟล์:** `scripts/production-deploy-config.mjs`, `scripts/production-deploy-config.test.ts`

**Interface ที่สร้าง:** `getDeploymentMatrix(config, targets = PRODUCTION_DEPLOYMENT_TARGETS)` คืน `{ include: Array<{ target, siteUrl, projectRef }> }`

- [ ] เขียน test ให้ matrix จาก Wrangler config มี project refs: `lpxsktjrkjzwbxvhjogo`, `vfqxpujsvgdqtrzpxobh`, `zkxpozvhvmgqfrwnlfrn`, `clrmtotmrpccddhoyxaf`, `nzxlbkcccfqoqqvhfmev` ตามลำดับ target
- [ ] เขียน test ที่ลบหรือแทนค่า `config.env.baan02.vars.CENTRAL_USER_MANAGER_PROJECT_REF` ด้วย `not-a-project-ref`; ต้อง error เป็น `baan02 is missing CENTRAL_USER_MANAGER_PROJECT_REF` และ `baan02 has an invalid CENTRAL_USER_MANAGER_PROJECT_REF`
- [ ] รัน `npm.cmd test -- scripts/production-deploy-config.test.ts` และยืนยันว่า fail เพราะ matrix ปัจจุบันไม่มี `projectRef`
- [ ] เพิ่ม `PROJECT_REF_VARIABLE = "CENTRAL_USER_MANAGER_PROJECT_REF"` และ `normalizeProjectRef(target, value)` ที่ยอมรับเฉพาะ `/^[a-z]{20}$/` โดย error ไม่เปิดเผย value
- [ ] ให้ `validateWranglerDeploymentConfig` ตรวจ ref ทุก target และให้ CLI `matrix` เรียก `getDeploymentMatrix(config)` แทน `createDeploymentMatrix` แบบไม่ใช้ config
- [ ] รัน `npm.cmd test -- scripts/production-deploy-config.test.ts`, `node scripts/production-deploy-config.mjs matrix`, `npm.cmd run validate:deploy:cf` และ `git diff --check`; ทั้งหมดต้องผ่านและไม่มี secret

### Task 2: สร้าง migration gate ใน GitHub Actions

**ไฟล์:** `.github/workflows/deploy-production.yml`, `scripts/production-deploy-workflow.test.ts`

**Interface ที่สร้าง:** `verify` ส่ง `migrations_changed` เป็น `true`/`false`; `migrate` รันเฉพาะ trusted push ที่เป็น true; `deploy` รอ `verify` และ `migrate`

- [ ] เขียน static test ยืนยัน `fetch-depth: 0`, `supabase/migrations/`, `github.event_name == 'push'`, migration secrets ทั้งสอง, `supabase link --project-ref "$BPV_SUPABASE_PROJECT_REF"`, `supabase db push --linked --include-all`, `needs: [verify, migrate]` และ condition ที่ยอมเฉพาะ migrate `success` หรือ `skipped`
- [ ] ตรวจเพิ่มว่า migration job มี `fail-fast: false`, `max-parallel: 2`, environment เป็น `${{ matrix.target }}` และ summary ไม่มีชื่อ secret
- [ ] รัน `npm.cmd test -- scripts/production-deploy-workflow.test.ts` และยืนยันว่า fail ก่อนแก้ workflow
- [ ] ตั้ง checkout ใน `verify` เป็น `fetch-depth: 0`; สำหรับ PR ให้ output `migrations_changed=false`; สำหรับ push ใช้ before SHA หรือ parent ของ SHA แรก แล้วตรวจ `git diff --quiet <range> -- supabase/migrations/`; หา commit ไม่ได้ต้อง fail closed
- [ ] เพิ่ม `migrate` job ที่ `needs: verify`, condition `github.event_name == 'push' && needs.verify.outputs.migrations_changed == 'true'`, matrix จาก verify, `fail-fast: false`, `max-parallel: 2`, timeout 30 นาที และ target GitHub Environment
- [ ] ใน migration step ใช้ env แค่ `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `BPV_SUPABASE_PROJECT_REF`; ติดตั้ง immutable revision ที่ review แล้วของ `supabase/setup-cli` v3 พร้อม CLI `2.115.0`; รัน `supabase link --project-ref "$BPV_SUPABASE_PROJECT_REF"` ตามด้วย `supabase db push --linked --include-all`
- [ ] เพิ่ม `always()` summary ที่มี target, project ref, commit และ outcome เท่านั้น
- [ ] เปลี่ยน deploy เป็น `needs: [verify, migrate]` และ condition `always() && needs.verify.result == 'success' && (needs.migrate.result == 'success' || needs.migrate.result == 'skipped')`; คง PR dry-run, Cloudflare secret scope และ `max-parallel: 3`
- [ ] รัน `npm.cmd test -- scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts` และ `git diff --check`; ทั้งหมดต้องผ่าน และ PR ต้องไม่อ้างถึง migration secrets

### Task 3: อัปเดตคู่มือการตั้งค่าและ recovery

**ไฟล์:** `README.md`, `docs/deployment.md`, `docs/ai/structure.html`

- [ ] เพิ่มหัวข้อ **Tenant Supabase migration gate** ใน `docs/deployment.md` ก่อน **Failed Deployment** ระบุ trigger, 5 targets, secret ทั้งสองพร้อม scope, การ block deploy เมื่อ fail และ GitHub **Re-run failed jobs** สำหรับ commit เดิม
- [ ] เพิ่ม `SUPABASE_ACCESS_TOKEN` ลง repository-secret table และ `SUPABASE_DB_PASSWORD` ลง Environment-secret table; ใน One-Time GitHub Setup ให้ระบุ environment secret ของ `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, `villaMedia` โดยไม่บันทึกค่า
- [ ] ใน `README.md` ระบุว่า migration รันก่อน deploy เฉพาะเมื่อ `supabase/migrations/` เปลี่ยน และลิงก์ไป runbook
- [ ] ใน `docs/ai/structure.html` เพิ่ม ownership ของ tested five-Tenant migration gate, project refs จาก `wrangler.jsonc` และ `scripts/production-deploy-workflow.test.ts`
- [ ] ใช้ `rg` ตรวจชื่อ secrets, trigger และ 5 targets ในเอกสาร; ค้นหาด้วย pattern `SUPABASE_DB_PASSWORD=.*|SUPABASE_ACCESS_TOKEN=.*` ต้องไม่พบ credential ที่กำหนดค่า; รัน `git diff --check`

### Task 4: ตรวจสอบขั้นสุดท้ายและ external readiness

**ไฟล์:** ตรวจสอบเท่านั้น ไม่มี source changes ใหม่

- [ ] รัน focused checks: `npm.cmd test -- scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts` และ `npm.cmd run validate:deploy:cf`
- [ ] รัน repository verification: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`
- [ ] ก่อน merge แรกที่แก้ migration ขออนุญาตชัดเจนเพื่อตั้ง/ตรวจ `SUPABASE_ACCESS_TOKEN` ระดับ repository/organization ที่มีสิทธิ์ทั้ง 5 projects และ `SUPABASE_DB_PASSWORD` ใน environment ทั้ง 5
- [ ] ตรวจได้เฉพาะชื่อ secret ผ่าน GitHub UI หรือ `gh secret list`; ห้ามพิมพ์ค่า และห้าม deploy หรือรัน remote migration ด้วยมือระหว่าง implementation
- [ ] รายงานผล focused/full test, lint, build, external secrets ที่ยังต้องตั้ง และไฟล์ที่เปลี่ยน ห้ามกล่าวว่า remote workflow รันแล้วจนกว่าจะ merge เข้า `master` และตรวจ workflow run จริง
