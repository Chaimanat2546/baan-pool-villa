-- Tenant-only recurring daily windows; preserve legacy/hourly contracts and grants.
begin;
create or replace function private.analytics_report(p_query jsonb,p_site_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare first_day date; last_day date; as_of_time timestamptz; starts timestamptz; ends timestamptz; result jsonb; available timestamptz; hourly_mode boolean; daily_window_mode boolean; requested_end timestamptz; fields text[];
begin
  available := private.analytics_initialize(p_site_id);
  hourly_mode := p_query->>'contract_version' = '1.1';
  daily_window_mode := p_query->>'contract_version' = '1.2';
  if jsonb_typeof(p_query) is distinct from 'object' or p_query->>'contract_version' is null or p_query->>'contract_version' not in ('1.0','1.1','1.2') or p_query->>'timezone' is distinct from 'Asia/Bangkok' then raise exception 'INVALID_QUERY'; end if;
  fields := array['contract_version','from_date','to_date','timezone','as_of','villa_id'];
  if hourly_mode or daily_window_mode then
    fields := fields || array['granularity','from_time','to_time'];
    if p_query->>'granularity' is distinct from (case when hourly_mode then 'hour' else 'day' end)
      or coalesce(p_query->>'from_time','') !~ '^(0[0-9]|1[0-9]|2[0-3]):00$'
      or coalesce(p_query->>'to_time','') !~ '^(0[1-9]|1[0-9]|2[0-3]|24):00$'
      or p_query->>'from_time' >= p_query->>'to_time'
      or (hourly_mode and p_query->>'from_date' is distinct from p_query->>'to_date') then raise exception 'INVALID_RANGE'; end if;
  end if;
  if not (p_query ?& fields) or (p_query-fields) <> '{}'::jsonb then raise exception 'INVALID_QUERY'; end if;
  if p_query->>'villa_id' is not null and (p_query->>'villa_id' !~ '^[1-9][0-9]{0,15}$' or (p_query->>'villa_id')::numeric > 9007199254740991) then raise exception 'INVALID_QUERY'; end if;
  if coalesce(p_query->>'from_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_query->>'to_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_query->>'as_of','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,3})?Z$' then raise exception 'INVALID_RANGE'; end if;
  first_day := (p_query->>'from_date')::date; last_day := (p_query->>'to_date')::date; as_of_time := (p_query->>'as_of')::timestamptz;
  if first_day is null or last_day is null or as_of_time is null or last_day < first_day or last_day-first_day >=92
     or as_of_time > now()+interval '5 minutes' or last_day > (as_of_time at time zone 'Asia/Bangkok')::date then raise exception 'INVALID_RANGE'; end if;
  starts := first_day::timestamp at time zone 'Asia/Bangkok';
  requested_end := (last_day+1)::timestamp at time zone 'Asia/Bangkok';
  if hourly_mode or daily_window_mode then
    requested_end := (last_day::timestamp at time zone 'Asia/Bangkok') + (substring(p_query->>'to_time',1,2)::integer * interval '1 hour');
    starts := starts + (substring(p_query->>'from_time',1,2)::integer * interval '1 hour');
  end if;
  ends := least(requested_end,as_of_time);
  with base as materialized (
    select villa_id,event_name,channel,occurred_at,(occurred_at at time zone 'Asia/Bangkok')::date as day
    from public.analytics_events where site_id=p_site_id and occurred_at>=starts and occurred_at<ends
      and (p_query->>'villa_id' is null or villa_id=p_query->>'villa_id')
      and (not daily_window_mode or (extract(hour from occurred_at at time zone 'Asia/Bangkok') >= substring(p_query->>'from_time',1,2)::integer
        and extract(hour from occurred_at at time zone 'Asia/Bangkok') < substring(p_query->>'to_time',1,2)::integer))
  ), totals as (
    select private.analytics_metrics(count(*) filter(where event_name='page_view'),count(*) filter(where channel='phone'),count(*) filter(where channel='chat'),count(*) filter(where channel='line'),count(*) filter(where event_name='gallery_open')) as metrics from base
  ), general as (
    select private.analytics_metrics(count(*) filter(where event_name='page_view'),count(*) filter(where channel='phone'),count(*) filter(where channel='chat'),count(*) filter(where channel='line'),count(*) filter(where event_name='gallery_open')) as metrics from base where villa_id is null
  ), villas as (
    select villa_id,private.analytics_metrics(count(*) filter(where event_name='page_view'),count(*) filter(where channel='phone'),count(*) filter(where channel='chat'),count(*) filter(where channel='line'),count(*) filter(where event_name='gallery_open')) as metrics from base where villa_id is not null group by villa_id
  ), days as (
    select first_day+n as day from generate_series(0,last_day-first_day) n
  ), daily as (
    select days.day,private.analytics_metrics(count(*) filter(where event_name='page_view'),count(*) filter(where channel='phone'),count(*) filter(where channel='chat'),count(*) filter(where channel='line'),count(*) filter(where event_name='gallery_open')) as metrics
    from days left join base on base.day=days.day group by days.day
  ), hours as (
    select h as starts_at, h + interval '1 hour' as ends_at
    from generate_series(starts,least(requested_end-interval '1 hour',ends-interval '1 microsecond'),interval '1 hour') h
    where hourly_mode
  ), hourly as (
    select hours.starts_at,hours.ends_at,private.analytics_metrics(count(*) filter(where event_name='page_view'),count(*) filter(where channel='phone'),count(*) filter(where channel='chat'),count(*) filter(where channel='line'),count(*) filter(where event_name='gallery_open')) as metrics
    from hours left join base on base.occurred_at>=hours.starts_at and base.occurred_at<hours.ends_at group by hours.starts_at,hours.ends_at
  ) select jsonb_build_object(
    'contract_version',p_query->>'contract_version','site_id',p_site_id,'query',p_query,'generated_at',now(),
    'coverage',(select jsonb_build_object('data_available_from',data_available_from,'range_complete',starts>=data_available_from,'rows_complete',true) from public.analytics_metadata where singleton),
    'totals',(select metrics from totals),'unattributed',(select metrics from general),
    'daily',(select jsonb_agg(metrics||jsonb_build_object('date',day) order by day) from daily),
    'villas',coalesce((select jsonb_agg(metrics||jsonb_build_object('villa_id',villa_id) order by villa_id collate "C") from villas),'[]'::jsonb)
  ) || case when hourly_mode then jsonb_build_object('hourly',coalesce((select jsonb_agg(metrics||jsonb_build_object('start',starts_at,'end',ends_at) order by starts_at) from hourly),'[]'::jsonb)) else '{}'::jsonb end into result;
  if jsonb_array_length(result->'villas')>10000 or octet_length(result::text)>3145728 then raise exception 'REPORT_TOO_LARGE'; end if;
  if exists(select 1 from jsonb_each(result->'totals') m where (m.value::text)::numeric>9007199254740991) then raise exception 'REPORT_TOO_LARGE'; end if;
  return result;
end $$;
notify pgrst, 'reload schema';
commit;
