// Local PostgreSQL-compatible execution; never reads .env or connects to a server.
// npm install --prefix .superpowers/analytics-test-runtime --no-save --package-lock=false @electric-sql/pglite
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  new URL(
    "../.superpowers/analytics-test-runtime/node_modules/@electric-sql/pglite/dist/index.js",
    import.meta.url,
  )
);
const db = new PGlite();
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema private;",
  );
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261006000000_create_site_analytics.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  const event = {
    schema_version: 1,
    event_id: "11111111-1111-4111-8111-111111111111",
    event_name: "contact_click",
    channel: "line",
    villa_id: "66",
    page_path: "/villas/66",
  };
  const insert = (e) =>
    db.query(
      "select public.analytics_insert_event($1::jsonb,'test-site') as result",
      [JSON.stringify(e)],
    );
  assert.equal((await insert(event)).rows[0].result, "stored");
  assert.equal((await insert(event)).rows[0].result, "duplicate");
  await assert.rejects(
    insert({ ...event, channel: "phone" }),
    /EVENT_ID_CONFLICT/,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.analytics_events"))
      .rows[0].n,
    1,
  );
  await assert.rejects(
    db.query("select public.analytics_insert_event($1::jsonb,'wrong-site')", [
      JSON.stringify(event),
    ]),
    /SITE_ID_MISMATCH/,
  );
  await assert.rejects(
    insert({
      ...event,
      event_id: crypto.randomUUID(),
      event_name: "gallery_open",
      channel: null,
      villa_id: null,
    }),
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select * from public.analytics_events"),
    /permission denied/,
  );
  await assert.rejects(
    insert({ ...event, event_id: crypto.randomUUID() }),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.exec(
    "update public.analytics_metadata set data_available_from='2026-09-01'; update public.analytics_events set occurred_at='2026-10-01T16:59:59Z';",
  );
  await db.exec(
    "insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,occurred_at,schema_version) select gen_random_uuid(),'test-site',n::text,'page_view',null,'/villas/'||n,'2026-10-01T17:00:00Z',1 from generate_series(1,2000) n;",
  );
  const query = {
    contract_version: "1.0",
    from_date: "2026-10-01",
    to_date: "2026-10-02",
    timezone: "Asia/Bangkok",
    as_of: "2026-10-03T00:00:00Z",
    villa_id: null,
  };
  const report = async (q) =>
    (
      await db.query(
        "select public.analytics_report($1::jsonb,'test-site') as result",
        [JSON.stringify(q)],
      )
    ).rows[0].result;
  const result = await report(query);
  assert.equal(result.villas.length, 2000);
  assert.equal(result.totals.page_views, 2000);
  assert.equal(result.totals.line_clicks, 1);
  assert.equal(result.daily[0].page_views, 0);
  assert.equal(result.daily[1].page_views, 2000);
  for (const metric of [
    "page_views",
    "phone_clicks",
    "chat_clicks",
    "line_clicks",
    "gallery_opens",
  ]) {
    assert.equal(
      result.totals[metric],
      result.villas.reduce((n, r) => n + r[metric], 0) +
        result.unattributed[metric],
    );
    assert.equal(
      result.totals[metric],
      result.daily.reduce((n, r) => n + r[metric], 0),
    );
  }
  assert.equal(
    (await report({ ...query, villa_id: "99999" })).villas.length,
    0,
  );
  await db.exec("set role service_role");
  assert.equal((await report(query)).totals.page_views, 2000);
  await assert.rejects(db.query("select * from public.analytics_events"), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(report(query), /permission denied/);
  await db.exec("reset role");
  await db.exec("insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,occurred_at,schema_version) select gen_random_uuid(),'test-site',n::text,'page_view',null,'/villas/'||n,'2026-10-01T17:00:00Z',1 from generate_series(2001,10001) n;");
  await assert.rejects(report(query), /REPORT_TOO_LARGE/);
  await db.exec("delete from public.analytics_events where villa_id::int > 2000;");
  const beforeFailure = (await db.query("select data_available_from from public.analytics_metadata")).rows[0];
  await assert.rejects(db.query("select public.analytics_prune_events('test-site',10001)"), /INVALID_BATCH/);
  assert.deepEqual((await db.query("select data_available_from from public.analytics_metadata")).rows[0], beforeFailure);
  await db.exec(
    "update public.analytics_events set occurred_at=now()-interval '181 days';",
  );
  await db.query("select public.analytics_prune_events('test-site',10000)");
  assert.equal(
    (await db.query("select count(*)::int as n from public.analytics_events"))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await report({ ...query, from_date: "2026-08-01" })).coverage
      .range_complete,
    false,
  );
  // Keep now() stable within a transaction to test the exact retention boundary.
  await db.exec("begin; insert into public.analytics_events(event_id,site_id,event_name,page_path,occurred_at) values(gen_random_uuid(),'test-site','page_view','/',now()-interval '180 days'),(gen_random_uuid(),'test-site','page_view','/',now()-interval '180 days 1 second');");
  const cleanup = (await db.query("select public.analytics_prune_events('test-site',10000) as result")).rows[0].result;
  assert.equal(cleanup.removed, 1);
  assert.equal((await db.query("select count(*)::int n from public.analytics_events")).rows[0].n, 1);
  await db.exec("rollback");
  console.log(
    "PASS: migration replay, insert/dedup/conflict, tenant/role isolation, 2,000 villas, 10,001-group rejection, Thai boundary, totals, retention cutoff/rollback",
  );
} finally {
  await db.close();
}
