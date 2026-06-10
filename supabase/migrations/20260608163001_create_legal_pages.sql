create table if not exists public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('terms', 'privacy')),
  title text not null check (length(trim(title)) > 0),
  seo_description text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_pages_content_blocks_array
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint legal_pages_publish_ready
    check (
      status <> 'published'
      or (
        length(trim(title)) > 0
        and jsonb_array_length(content_blocks) > 0
      )
    )
);

create index if not exists legal_pages_public_slug_idx
  on public.legal_pages (slug, status);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'legal_pages_set_updated_at'
      and tgrelid = 'public.legal_pages'::regclass
  ) then
    create trigger legal_pages_set_updated_at
      before update on public.legal_pages
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.legal_pages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Anon users can select published legal pages'
  ) then
    create policy "Anon users can select published legal pages"
      on public.legal_pages
      for select
      to anon
      using (status = 'published');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated users can select visible legal pages'
  ) then
    create policy "Authenticated users can select visible legal pages"
      on public.legal_pages
      for select
      to authenticated
      using (status = 'published' or private.is_home_config_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated admins can insert legal pages'
  ) then
    create policy "Authenticated admins can insert legal pages"
      on public.legal_pages
      for insert
      to authenticated
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated admins can update legal pages'
  ) then
    create policy "Authenticated admins can update legal pages"
      on public.legal_pages
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.legal_pages to anon, authenticated;
grant insert, update on public.legal_pages to authenticated;

insert into public.legal_pages (
  slug,
  title,
  seo_description,
  content_blocks,
  status,
  published_at
)
values
  (
    'terms',
    'Terms and Conditions',
    'Booking terms and conditions for Baan Pool Villa.',
    '[{"type":"paragraph","content":[{"type":"text","text":"Please contact us for the latest booking terms."}]}]'::jsonb,
    'published',
    now()
  ),
  (
    'privacy',
    'Privacy Policy',
    'Privacy policy for Baan Pool Villa.',
    '[{"type":"paragraph","content":[{"type":"text","text":"Please contact us for the latest privacy policy."}]}]'::jsonb,
    'published',
    now()
  )
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
