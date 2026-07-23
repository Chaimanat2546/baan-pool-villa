-- Existing public functions can retain direct grants across create or replace.
revoke all on function private.save_home_section_snapshot(jsonb)
  from anon, public;
revoke all on function public.save_home_section_snapshot(jsonb)
  from anon, public;

grant execute on function private.save_home_section_snapshot(jsonb)
  to authenticated;
grant execute on function public.save_home_section_snapshot(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
