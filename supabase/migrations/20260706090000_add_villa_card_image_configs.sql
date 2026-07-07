create table if not exists public.villa_card_image_configs (
  id uuid primary key default gen_random_uuid(),
  page_key text not null default 'default' check (page_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  house_id text not null check (house_id ~ '^[1-9][0-9]*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_key, house_id)
);

create table if not exists public.villa_card_image_items (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.villa_card_image_configs(id) on delete cascade,
  image_id integer not null check (image_id > 0),
  sort_order smallint not null check (sort_order between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (config_id, image_id),
  unique (config_id, sort_order)
);

create index if not exists villa_card_image_configs_lookup_idx
  on public.villa_card_image_configs (page_key, house_id, is_active);

create index if not exists villa_card_image_items_order_idx
  on public.villa_card_image_items (config_id, sort_order);

drop trigger if exists villa_card_image_configs_set_updated_at
  on public.villa_card_image_configs;

create trigger villa_card_image_configs_set_updated_at
  before update on public.villa_card_image_configs
  for each row execute function private.set_updated_at();

drop trigger if exists villa_card_image_items_set_updated_at
  on public.villa_card_image_items;

create trigger villa_card_image_items_set_updated_at
  before update on public.villa_card_image_items
  for each row execute function private.set_updated_at();

alter table public.villa_card_image_configs enable row level security;
alter table public.villa_card_image_items enable row level security;

drop policy if exists "Anon users can select active villa card image configs"
  on public.villa_card_image_configs;

create policy "Anon users can select active villa card image configs"
  on public.villa_card_image_configs
  for select
  to anon
  using (is_active);

drop policy if exists "Authenticated users can select visible villa card image configs"
  on public.villa_card_image_configs;

create policy "Authenticated users can select visible villa card image configs"
  on public.villa_card_image_configs
  for select
  to authenticated
  using (is_active or private.is_home_config_admin());

drop policy if exists "Authenticated admins can insert villa card image configs"
  on public.villa_card_image_configs;

create policy "Authenticated admins can insert villa card image configs"
  on public.villa_card_image_configs
  for insert
  to authenticated
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can update villa card image configs"
  on public.villa_card_image_configs;

create policy "Authenticated admins can update villa card image configs"
  on public.villa_card_image_configs
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can delete villa card image configs"
  on public.villa_card_image_configs;

create policy "Authenticated admins can delete villa card image configs"
  on public.villa_card_image_configs
  for delete
  to authenticated
  using (private.is_home_config_admin());

drop policy if exists "Anon users can select active villa card image items"
  on public.villa_card_image_items;

create policy "Anon users can select active villa card image items"
  on public.villa_card_image_items
  for select
  to anon
  using (
    exists (
      select 1
      from public.villa_card_image_configs config
      where config.id = villa_card_image_items.config_id
        and config.is_active
    )
  );

drop policy if exists "Authenticated users can select visible villa card image items"
  on public.villa_card_image_items;

create policy "Authenticated users can select visible villa card image items"
  on public.villa_card_image_items
  for select
  to authenticated
  using (
    private.is_home_config_admin()
    or exists (
      select 1
      from public.villa_card_image_configs config
      where config.id = villa_card_image_items.config_id
        and config.is_active
    )
  );

drop policy if exists "Authenticated admins can insert villa card image items"
  on public.villa_card_image_items;

create policy "Authenticated admins can insert villa card image items"
  on public.villa_card_image_items
  for insert
  to authenticated
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can update villa card image items"
  on public.villa_card_image_items;

create policy "Authenticated admins can update villa card image items"
  on public.villa_card_image_items
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can delete villa card image items"
  on public.villa_card_image_items;

create policy "Authenticated admins can delete villa card image items"
  on public.villa_card_image_items
  for delete
  to authenticated
  using (private.is_home_config_admin());

grant select on public.villa_card_image_configs, public.villa_card_image_items
  to anon, authenticated;

grant insert, update, delete
  on public.villa_card_image_configs, public.villa_card_image_items
  to authenticated;

notify pgrst, 'reload schema';
