// Disposable local PostgreSQL-compatible database. Never reads .env or contacts Supabase.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  new URL(
    "../.superpowers/analytics-test-runtime/node_modules/@electric-sql/pglite/dist/index.js",
    import.meta.url,
  )
);
const { pg_trgm } = await import(new URL("../.superpowers/analytics-test-runtime/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js", import.meta.url));
const db = new PGlite({ extensions: { pg_trgm } });
const userId = "10000000-0000-4000-8000-000000000001";
const adId = "20000000-0000-4000-8000-000000000001";
const imageId = "30000000-0000-4000-8000-000000000001";
const nextId = "30000000-0000-4000-8000-000000000002";
const thirdId = "30000000-0000-4000-8000-000000000003";
const image = (id) => ({ id, storagePath: `${adId}/${id}.webp` });
try {
  await db.exec(`create role anon; create role authenticated; create schema private; create schema auth; create schema storage; create schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user', true),'')::uuid $$;
    create function private.is_home_config_admin() returns boolean language plpgsql as $$ begin return coalesce(current_setting('test.admin', true),'false') = 'true'; end $$;
    revoke all on function private.is_home_config_admin() from public, anon;
    grant execute on function private.is_home_config_admin() to authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key, bucket_id text, name text); alter table storage.objects enable row level security;
    grant usage on schema auth, storage to anon, authenticated; grant select,insert,update,delete on storage.objects to authenticated;
    insert into auth.users values ('${userId}');
    select set_config('test.user','${userId}',false); select set_config('test.admin','true',false);`);
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261020000000_create_site_advertisements.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  const publicReadFix = await readFile(
    new URL("../supabase/migrations/20261020010000_fix_site_advertisement_public_reads.sql", import.meta.url),
    "utf8",
  );
  await db.exec(publicReadFix);
  await db.exec(publicReadFix);
  await db.exec("set role authenticated");
  const upload = async (id) =>
    db.query(
      "insert into public.site_advertisement_uploads (id,storage_path) values ($1,$2)",
      [id, image(id).storagePath],
    );
  await upload(imageId);
  await upload(nextId);
  await upload(thirdId);
  const ad = {
    id: adId,
    title: "กิจกรรม",
    zone: "all",
    isActive: true,
    sortOrder: 7,
    updatedAt: null,
  };
  const save = async (draft, images) =>
    (
      await db.query(
        "select public.save_site_advertisement($1::jsonb,$2::jsonb) as result",
        [JSON.stringify(draft), JSON.stringify(images)],
      )
    ).rows[0].result;
  let saved = await save(ad, [image(imageId), image(nextId), image(thirdId)]);
  await db.exec("reset role");
  const imageLimitPatch = await readFile(new URL("../supabase/migrations/20261020020000_limit_site_advertisement_images_to_two.sql", import.meta.url), "utf8");
  await db.exec(imageLimitPatch);
  await db.exec(imageLimitPatch);
  assert.equal((await db.query("select * from public.site_advertisement_images")).rows.length, 3, "migration must preserve older images");
  const autoOrderPatch = await readFile(new URL("../supabase/migrations/20261020030000_auto_order_site_advertisements.sql", import.meta.url), "utf8");
  await db.exec(autoOrderPatch);
  await db.exec(autoOrderPatch);
  const queryPatch = await readFile(new URL("../supabase/migrations/20261020040000_optimize_site_advertisement_queries.sql", import.meta.url), "utf8");
  await db.exec(queryPatch);
  await db.exec(queryPatch);
  await db.exec("set role authenticated");
  await assert.rejects(save({ ...ad, updatedAt: saved.updatedAt }, [image(imageId), image(nextId), image(thirdId)]), /Invalid advertisement images/);
  assert.equal((await db.query("select * from public.site_advertisement_images")).rows.length, 3, "rejected save must leave the old snapshot intact");
  saved = await save({ ...ad, sortOrder: 9999, updatedAt: saved.updatedAt }, [image(imageId), image(nextId)]);
  assert.equal((await db.query("select sort_order from public.site_advertisements where id = $1", [adId])).rows[0].sort_order, 7, "editing must preserve the stored rank even if a legacy client sends another");
  assert.deepEqual(saved.removedPaths, [image(thirdId).storagePath]);
  assert.equal(saved.id, adId);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}; select set_config('test.admin','false',false)`);
    assert.equal((await db.query("select * from public.site_advertisements")).rows.length, 1);
    assert.equal((await db.query("select * from public.site_advertisement_images")).rows.length, 2);
  }
  await db.exec("set role authenticated; select set_config('test.admin','true',false)");
  await assert.rejects(save(ad, [image(imageId)]), /changed/);
  await assert.rejects(
    save(
      { ...ad, updatedAt: null, id: "20000000-0000-4000-8000-000000000002" },
      [image(imageId)],
    ),
    /belong/,
  );
  saved = await save({ ...ad, updatedAt: saved.updatedAt }, [
    image(nextId),
    image(imageId),
  ]);
  assert.equal(
    (
      await db.query(
        "select id from public.site_advertisement_images order by display_order",
      )
    ).rows[0].id,
    nextId,
  );
  saved = await save({ ...ad, isActive: false, updatedAt: saved.updatedAt }, [
    image(nextId),
  ]);
  assert.deepEqual(saved.removedPaths, [image(imageId).storagePath]);
  await assert.rejects(
    save({ ...ad, updatedAt: saved.updatedAt }, [image(imageId)]),
    /belong/,
  );
  await assert.rejects(
    db.query("select public.delete_site_advertisement($1,$2)", [
      adId,
      "2020-01-01T00:00:00Z",
    ]),
    /changed/,
  );
  await db.exec("set role anon; select set_config('test.admin','false',false)");
  assert.equal(
    (await db.query("select * from public.site_advertisements")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.site_advertisement_images")).rows
      .length,
    0,
  );
  await assert.rejects(save(ad, [image(imageId)]), /permission denied/);
  await db.exec(
    "set role authenticated; select set_config('test.admin','false',false)",
  );
  assert.equal((await db.query("select * from public.site_advertisements")).rows.length, 0);
  assert.equal((await db.query("select * from public.site_advertisement_images")).rows.length, 0);
  await assert.rejects(save(ad, [image(imageId)]), /Admin access required/);
  await assert.rejects(
    db.query(
      "insert into public.site_advertisement_uploads (id,storage_path) values ($1,$2)",
      [crypto.randomUUID(), "bad"],
    ),
  );
  await db.exec("select set_config('test.admin','true',false)");
  assert.equal((await db.query("select * from public.site_advertisements")).rows.length, 1);
  assert.equal((await db.query("select * from public.site_advertisement_images")).rows.length, 1);
  const deleted = (
    await db.query("select public.delete_site_advertisement($1,$2) as result", [
      adId,
      saved.updatedAt,
    ])
  ).rows[0].result;
  assert.deepEqual(deleted.removedPaths, [image(nextId).storagePath]);
  assert.equal(
    (await db.query("select * from public.site_advertisement_images")).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.site_advertisement_uploads")).rows
      .length,
    3,
  );
  for (const [index, expectedOrder] of [[2, 0], [3, 10000]]) {
    if (index === 3) {
      await db.exec("reset role; update public.site_advertisements set sort_order = 9999; set role authenticated");
    }
    const newAdId = `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const newImageId = crypto.randomUUID();
    const storagePath = `${newAdId}/${newImageId}.webp`;
    await db.query("insert into public.site_advertisement_uploads (id,storage_path) values ($1,$2)", [newImageId, storagePath]);
    const newAd = { ...ad };
    delete newAd.sortOrder;
    await save({ ...newAd, id: newAdId }, [{ id: newImageId, storagePath }]);
    assert.equal((await db.query("select sort_order from public.site_advertisements where id = $1", [newAdId])).rows[0].sort_order, expectedOrder, "new advertisements append without a client rank");
  }
  await db.exec("reset role");
  await db.query(`insert into public.site_advertisements(id,title,zone,is_active,sort_order)
    select md5('index-fixture-'||i)::uuid, case when i=49999 then $1 else 'กิจกรรมทั่วไป '||i end,
    case when i%2=0 then 'all' else 'pattaya' end, i%3<>0, i+10000 from generate_series(1,50000) i`,
    ["ล่องเรือชมทะเล Sunset 50%_ราคา" + String.fromCharCode(92) + "พิเศษ"]);
  // Flush bulk-load GIN pending entries; the disposable runtime has no autovacuum worker.
  await db.exec("vacuum (analyze) public.site_advertisements");
  const explain = async (sql, values=[]) => (await db.query("explain (format json) "+sql, values)).rows[0]["QUERY PLAN"][0].Plan;
  const planIndexes = plan => [plan["Index Name"], ...(plan.Plans ?? []).flatMap(planIndexes)].filter(Boolean);
  assert.ok(planIndexes(await explain("select id from public.site_advertisements order by sort_order,id limit 8")).includes("site_advertisements_order_idx"));
  assert.ok(planIndexes(await explain("select max(sort_order) from public.site_advertisements")).includes("site_advertisements_order_idx"));
  // The private RPC runs its SELECT as the table owner after checking admin access.
  for (const term of ["%Sunset%", "%ล่องเรือชมทะเล%"]){
    const titlePlan = await explain("select id from public.site_advertisements where title ilike $1 order by sort_order,id limit 8", [term]);
    assert.ok(planIndexes(titlePlan).includes("site_advertisements_title_trgm_idx"), JSON.stringify(titlePlan));
  }
  const list = async (page=1, search="", zone="", status="all") =>
    (await db.query("select public.list_site_advertisements($1,$2,$3,$4) as result", [page,search,zone,status])).rows[0].result;
  await db.exec("set role authenticated; select set_config('test.admin','true',false)");
  const firstPage = await list();
  const secondPage = await list(2);
  assert.equal(firstPage.advertisements.length, 8);
  assert.equal(firstPage.total, 50002);
  assert.equal(secondPage.total, firstPage.total);
  assert.ok(secondPage.advertisements.every(row => !firstPage.advertisements.some(first => first.id===row.id)));
  for (const term of ["ล่องเรือชมทะเล", "SUNSET", "50%_ราคา" + String.fromCharCode(92)]) {
    const result = await list(1,term,"pattaya","active");
    assert.equal(result.total,1, "Thai, case-insensitive and escaped literal searches must retain exact matches");
    assert.equal(result.advertisements.length,1);
  }
  assert.equal((await list(2,"ล่องเรือชมทะเล")).total,1);
  assert.equal((await list(2,"ล่องเรือชมทะเล")).advertisements.length,0);
  assert.equal((await list(1,"' OR true --")).total,0);
  assert.equal((await list(1,"ล่องเรือชมทะเล","pattaya","inactive")).total,0);
  for (const args of [[0,"","","all"],[1,"","invalid","all"],[1,"","","invalid"],[1,"a".repeat(161),"","all"]]) {
    await assert.rejects(list(...args), /Invalid advertisement list filters/);
  }
  await db.exec("select set_config('test.admin','false',false)");
  await assert.rejects(list(), /Admin access required/);
  await db.exec("set role anon");
  await assert.rejects(list(), /permission denied/);
  await db.exec("reset role; alter extension pg_trgm set schema public");
  await db.exec(queryPatch);
  assert.equal((await db.query("select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm'")).rows[0].nspname,"public", "migration must preserve an existing extension schema");
  console.log("PASS: 50,002-record order/MAX/Thai search index plans, admin RPC pagination/filtering/literal escaping, denied anonymous/non-admin reads and extension-schema preservation");
  console.log(
    "PASS: automatic append order and preserved edit order, two-image save limit, preserved legacy images, idempotent migrations, local ownership, atomic save/order/delete, stale edits, public RLS, authorization and retained history",
  );
} finally {
  await db.close();
}
