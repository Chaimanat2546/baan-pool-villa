import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  "supabase/migrations/20260907120000_create_villa_reviews.sql",
);

async function readMigration() {
  return (await readFile(migrationPath, "utf8"))
    .replace(/--[^\n]*/g, "")
    .toLowerCase();
}

describe("villa review migration privacy contract", () => {
  it("exposes only the safe review projection and ordered image ids/URLs", async () => {
    const migration = await readMigration();
    const view = migration.match(
      /create or replace view public\.villa_reviews_public\b[^;]+;/,
    )?.[0];
    expect(view).toBeDefined();
    expect(view).not.toMatch(/booking_code|phone_e164|storage_path|storage_bucket|snapshot|select\s+\*/);
    expect(view).toContain("security_barrier = true");
    expect(view).toContain("security_invoker = false");
    expect(view).toMatch(/r\.id,\s*r\.villa_id,\s*r\.rating,\s*r\.comment,\s*r\.masked_phone,\s*r\.created_at,\s*r\.updated_at/);
    expect(view).toMatch(/jsonb_build_object\('id', i\.id, 'url', i\.public_url\)/);
    expect(view).toMatch(/order by i\.display_order/);
    expect(view).toContain("'[]'::jsonb");
    expect(migration).toMatch(/masked_phone text generated always as\s*\('xxx-xxxx-' \|\| right\(phone_e164, 4\)\) stored/);
  });

  it("denies browser access to every base table and grants only view SELECT", async () => {
    const migration = await readMigration();
    for (const table of ["villa_reviews", "villa_review_images", "villa_review_edit_logs"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toMatch(new RegExp(`revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role`));
    }
    const browserGrants = migration.match(/grant\s+[^;]+\bto\s+(?:public|anon|authenticated)\b[^;]*;/g);
    expect(browserGrants).toEqual([
      "grant select on table public.villa_reviews_public to anon, authenticated, service_role;",
    ]);
    expect(migration).toContain("revoke all on table public.villa_reviews_public from public, anon, authenticated, service_role");
    expect(migration).not.toMatch(/create policy[^;]+on public\.villa_review/);
  });

  it("enforces global booking uniqueness, rating bounds, and at most five ordered images", async () => {
    const migration = await readMigration();
    expect(migration).toMatch(/unique\s*\(booking_code\)/);
    expect(migration).toMatch(/check\s*\(rating between 1 and 5\)/);
    expect(migration).toMatch(/check\s*\(display_order between 1 and 5\)/);
    expect(migration).toMatch(/unique\s*\(review_id, display_order\)/);
    expect(migration).toMatch(/on public\.villa_reviews\s*\(villa_id, created_at desc, id desc\)/);
    expect(migration).toMatch(/on public\.villa_reviews\s*\(villa_id, rating desc, id desc\)/);
  });

  it("allows an optional comment while retaining its 1,000-character limit", async () => {
    const migration = await readMigration();
    expect(migration).toContain("char_length(btrim(comment)) <= 1000");
    expect(migration).not.toContain("char_length(btrim(comment)) between 1 and 1000");
  });

  it("keeps extensible before/after edit snapshots private", async () => {
    const migration = await readMigration();
    const table = migration.match(/create table if not exists public\.villa_review_edit_logs\s*\([\s\S]+?\n\);/)?.[0];
    expect(table).toContain("before_snapshot jsonb not null");
    expect(table).toContain("after_snapshot jsonb not null");
    expect(table).toContain("created_at timestamptz not null default now()");
    expect(table).toContain("references public.villa_reviews(id)");
  });

  it("restricts both RPC layers to service role and inserts parent/images together", async () => {
    const migration = await readMigration();
    const implementation = migration.match(/create or replace function private\.submit_villa_review_impl\([\s\S]+?\$\$;/)?.[0];
    const wrapper = migration.match(/create or replace function public\.submit_villa_review\([\s\S]+?\$\$;/)?.[0];
    expect(implementation).toContain("security definer");
    expect(implementation).toContain("set search_path = pg_catalog");
    expect(implementation).toContain("auth.role() is distinct from 'service_role'");
    expect(implementation).toContain("errcode = '42501'");
    expect(implementation).toContain("insert into public.villa_reviews");
    expect(implementation).toContain("insert into public.villa_review_images");
    expect(implementation).not.toMatch(/exception\s+when|on conflict|\bcommit\b/);
    expect(wrapper).toContain("security invoker");
    expect(wrapper).toContain("return private.submit_villa_review_impl(");
    for (const name of ["private.submit_villa_review_impl", "public.submit_villa_review"]) {
      expect(migration).toContain(`revoke all on function ${name}(text, text, text, integer, text, jsonb)\n  from public, anon, authenticated, service_role`);
      expect(migration).toContain(`grant execute on function ${name}(text, text, text, integer, text, jsonb)\n  to service_role`);
    }
    expect(migration).not.toMatch(/grant\s+(?:all|insert)[^;]+on table public\.villa_reviews\b/);
  });

  it("validates nullable and malformed image JSON before any insert", async () => {
    const migration = await readMigration();
    const validation = migration.slice(
      migration.indexOf("create or replace function private.submit_villa_review_impl"),
      migration.indexOf("insert into public.villa_reviews"),
    );
    expect(validation).toContain("jsonb_typeof(p_images) is distinct from 'array'");
    expect(validation).toContain("jsonb_array_length(p_images) > 5");
    expect(validation).toContain("jsonb_typeof(v_image) is distinct from 'object'");
    expect(validation).toContain("jsonb_typeof(v_image -> 'storage_path') is distinct from 'string'");
    expect(validation).toContain("jsonb_typeof(v_image -> 'public_url') is distinct from 'string'");
    expect(validation).toContain("v_image - array['storage_path', 'public_url'] <> '{}'::jsonb");
    expect(validation).toContain("errcode = '22023'");
    expect(migration).toContain("with ordinality as image(value, display_order)");
  });

  it("creates a public image-only bucket with a scoped browser write denial", async () => {
    const migration = await readMigration();
    expect(migration).toMatch(/insert into storage\.buckets[^;]+'villa-reviews'[^;]+true[^;]+on conflict \(id\) do update/);
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(migration).toMatch(/create policy "villa review storage browser boundary"\s+on storage\.objects\s+as restrictive\s+for all\s+to anon, authenticated\s+using \(bucket_id <> 'villa-reviews'\)\s+with check \(bucket_id <> 'villa-reviews'\)/);
    expect(migration).toContain("grant select, insert, update, delete on table storage.objects to service_role");
    expect(migration).not.toMatch(/revoke[^;]+on (?:table )?storage\.objects/);
    expect(migration).toContain("storage_bucket = 'villa-reviews'");
    expect(migration).toContain("^villa-reviews/");
  });

  it("permits local loopback image URLs while requiring HTTPS elsewhere", async () => {
    const migration = await readMigration();
    expect(migration).toContain("http://(localhost|127\\.0\\.0\\.1)");
    expect(migration).toContain("https://[a-za-z0-9]");
  });

  it("remains additive and reloads PostgREST without seed or destructive data operations", async () => {
    const migration = await readMigration();
    expect(migration.match(/create table if not exists public\.villa_review/g)).toHaveLength(3);
    expect(migration).not.toMatch(/\b(delete from|truncate|drop table|drop schema|insert into public\.site_)\b/);
    expect(migration.trim()).toMatch(/notify pgrst, 'reload schema';$/);
  });
});
