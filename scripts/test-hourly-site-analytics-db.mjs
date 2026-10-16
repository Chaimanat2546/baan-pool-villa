// Uses a database created by this process in an existing LOCAL Docker container.
// No .env, remote connections, dependency installation or existing tenant writes.
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const container = process.argv[2];
if (!container || !/^supabase_db_[A-Za-z0-9_-]+$/.test(container)) throw Error("Pass a local supabase_db_ Docker container name");
const database = `bpv_hourly_test_${process.pid}`;
function docker(args, input) {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || "Docker SQL check failed");
  return result.stdout;
}
const read = path => readFile(new URL(path, import.meta.url), "utf8");
const base = await read("../supabase/migrations/20261006000000_create_site_analytics.sql");
let upgrade = "";
try { upgrade = await read("../supabase/migrations/20261016000000_add_hourly_site_analytics.sql"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (upgrade) assert.equal(upgrade.replaceAll("\r\n", "\n"), (await read("../supabase/patches/20261016_hourly_site_analytics.sql")).replaceAll("\r\n", "\n"));
docker(["createdb", "-U", "postgres", database]);
try {
  const tests = await read("./hourly-site-analytics-test.sql");
  const legacy = await read("./legacy-site-analytics-test.sql");
  const sql = `create schema private;\n${base}\n${upgrade}\n${upgrade}\n${tests}\n${legacy}`;
  process.stdout.write(docker(["psql", "-U", "postgres", "-d", database, "-X", "-q", "-v", "ON_ERROR_STOP=1"], sql));
  console.log("PASS: hourly/legacy SQL, midnight/snapshot/coverage, sums, villa filtering, identity, role isolation, replay, 2000/10001 villas, retention and rollback");
} finally {
  docker(["dropdb", "-U", "postgres", database]);
}
