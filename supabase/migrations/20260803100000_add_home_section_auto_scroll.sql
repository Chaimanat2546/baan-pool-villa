alter table public.home_sections
  add column if not exists auto_scroll_enabled boolean not null default false;

create or replace function public.save_home_section_snapshot(snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  perform private.save_home_section_snapshot(snapshot);

  update public.home_sections as stored_section
  set auto_scroll_enabled = coalesce(
    (snapshot_section.value ->> 'auto_scroll_enabled')::boolean,
    false
  )
  from jsonb_array_elements(
    coalesce(snapshot -> 'sections', '[]'::jsonb)
  ) as snapshot_section(value)
  where stored_section.slug = snapshot_section.value ->> 'slug';
end;
$$;

revoke all on function public.save_home_section_snapshot(jsonb) from public;
grant execute on function public.save_home_section_snapshot(jsonb) to authenticated;

notify pgrst, 'reload schema';
