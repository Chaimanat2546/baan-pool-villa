grant select on table public.images to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'images'
      and policyname = 'Public can read images'
  ) then
    create policy "Public can read images"
      on public.images
      for select
      to anon
      using (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
