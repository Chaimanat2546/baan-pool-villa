alter table public.home_sections
  drop constraint if exists home_sections_limit_count_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'home_sections_limit_count_positive_check'
      and conrelid = 'public.home_sections'::regclass
  ) then
    alter table public.home_sections
      add constraint home_sections_limit_count_positive_check
      check (limit_count >= 1);
  end if;
end;
$$;

notify pgrst, 'reload schema';
