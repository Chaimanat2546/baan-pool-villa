// Disposable local PostgreSQL-compatible database. Never reads .env or contacts Supabase.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  new URL(
    "../.superpowers/analytics-test-runtime/node_modules/@electric-sql/pglite/dist/index.js",
    import.meta.url,
  )
);
const db = new PGlite();
const userId = "10000000-0000-4000-8000-000000000001";
const adId = "20000000-0000-4000-8000-000000000001";
const imageId = "30000000-0000-4000-8000-000000000001";
const nextId = "30000000-0000-4000-8000-000000000002";
const image = (id) => ({ id, storagePath: `${adId}/${id}.webp` });
try {
  await db.exec(`create role anon; create role authenticated; create schema private; create schema auth; create schema storage;
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
  const ad = {
    id: adId,
    title: "กิจกรรม",
    zone: "all",
    isActive: true,
    sortOrder: 0,
    updatedAt: null,
  };
  const save = async (draft, images) =>
    (
      await db.query(
        "select public.save_site_advertisement($1::jsonb,$2::jsonb) as result",
        [JSON.stringify(draft), JSON.stringify(images)],
      )
    ).rows[0].result;
  let saved = await save(ad, [image(imageId), image(nextId)]);
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
    2,
  );
  console.log(
    "PASS: idempotent migration, local ownership, atomic save/order/delete, stale edits, no asset reuse, public RLS, admin authorization and retained history",
  );
} finally {
  await db.close();
}
