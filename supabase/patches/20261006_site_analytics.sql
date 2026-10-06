-- Tenant-only analytics. Never apply to the shared catalog project.
begin;
create schema if not exists private;
create table if not exists public.analytics_metadata (
  singleton boolean primary key default true check(singleton),
  site_id text not null check(length(site_id) between 1 and 128),
  data_available_from timestamptz not null default now()
);
create table if not exists public.analytics_events (
  event_id uuid primary key,
  site_id text not null check(length(site_id) between 1 and 128),
  villa_id text check(villa_id ~ '^[1-9][0-9]{0,15}$'),
  event_name text not null check(event_name in ('page_view','contact_click','gallery_open')),
  channel text,
  page_path text not null check(length(page_path) between 1 and 512 and left(page_path,1)='/' and page_path !~ '[?#[:space:]]'),
  occurred_at timestamptz not null default now(),
  schema_version smallint not null default 1 check(schema_version=1),
  check ((event_name='contact_click' and channel is not null and channel in ('phone','chat','line')) or (event_name in ('page_view','gallery_open') and channel is null)),
  check(event_name <> 'gallery_open' or villa_id is not null)
);
create index if not exists analytics_events_time_idx on public.analytics_events(occurred_at);
create index if not exists analytics_events_villa_time_idx on public.analytics_events(villa_id,occurred_at);
alter table public.analytics_metadata enable row level security;
alter table public.analytics_events enable row level security;
revoke all on public.analytics_metadata, public.analytics_events from public, anon, authenticated, service_role;

create or replace function private.analytics_initialize(p_site_id text) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare m public.analytics_metadata;
begin
  if p_site_id is null or length(p_site_id) not between 1 and 128 then raise exception 'SITE_ID_MISMATCH'; end if;
  insert into public.analytics_metadata(singleton,site_id) values(true,p_site_id) on conflict do nothing;
  select * into strict m from public.analytics_metadata where singleton;
  if m.site_id <> p_site_id then raise exception 'SITE_ID_MISMATCH'; end if;
  return m.data_available_from;
end $$;

create or replace function private.analytics_insert_event(p_event jsonb,p_site_id text) returns text
language plpgsql security definer set search_path='' as $$
declare existing public.analytics_events; inserted_id uuid;
begin
  perform private.analytics_initialize(p_site_id);
  if jsonb_typeof(p_event) <> 'object' or not (p_event ?& array['event_id','schema_version','event_name','channel','villa_id','page_path'])
     or (p_event - array['event_id','schema_version','event_name','channel','villa_id','page_path']) <> '{}'::jsonb then raise exception 'INVALID_EVENT'; end if;
  insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,schema_version)
    values((p_event->>'event_id')::uuid,p_site_id,p_event->>'villa_id',p_event->>'event_name',p_event->>'channel',p_event->>'page_path',(p_event->>'schema_version')::smallint)
    on conflict(event_id) do nothing returning event_id into inserted_id;
  if inserted_id is not null then return 'stored'; end if;
  select * into strict existing from public.analytics_events where event_id=(p_event->>'event_id')::uuid;
  if existing.site_id <> p_site_id or existing.villa_id is distinct from p_event->>'villa_id'
    or existing.event_name is distinct from p_event->>'event_name' or existing.channel is distinct from p_event->>'channel'
    or existing.page_path is distinct from p_event->>'page_path' or existing.schema_version <> (p_event->>'schema_version')::smallint
  then raise exception 'EVENT_ID_CONFLICT'; end if;
  return 'duplicate';
end $$;

create or replace function private.analytics_metrics(p bigint,ph bigint,ch bigint,l bigint,g bigint) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('page_views',p,'phone_clicks',ph,'chat_clicks',ch,'line_clicks',l,'gallery_opens',g)
$$;

create or replace function private.analytics_report(p_query jsonb,p_site_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare first_day date; last_day date; as_of_time timestamptz; starts timestamptz; ends timestamptz; result jsonb; available timestamptz;
begin
  available := private.analytics_initialize(p_site_id);
  if p_query->>'contract_version' <> '1.0' or p_query->>'timezone' <> 'Asia/Bangkok' then raise exception 'INVALID_QUERY'; end if;
  first_day := (p_query->>'from_date')::date; last_day := (p_query->>'to_date')::date; as_of_time := (p_query->>'as_of')::timestamptz;
  if first_day is null or last_day is null or as_of_time is null or last_day < first_day or last_day-first_day >=92
     or as_of_time > now()+interval '5 minutes' or last_day > (as_of_time at time zone 'Asia/Bangkok')::date then raise exception 'INVALID_RANGE'; end if;
  starts := first_day::timestamp at time zone 'Asia/Bangkok';
  ends := least((last_day+1)::timestamp at time zone 'Asia/Bangkok',as_of_time);
  with base as materialized (
    select villa_id,event_name,channel,(occurred_at at time zone 'Asia/Bangkok')::date as day
    from public.analytics_events where site_id=p_site_id and occurred_at>=starts and occurred_at<ends
      and (p_query->>'villa_id' is null or villa_id=p_query->>'villa_id')
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
  ) select jsonb_build_object(
    'contract_version','1.0','site_id',p_site_id,'query',p_query,'generated_at',now(),
    'coverage',(select jsonb_build_object('data_available_from',data_available_from,'range_complete',starts>=data_available_from,'rows_complete',true) from public.analytics_metadata where singleton),
    'totals',(select metrics from totals),'unattributed',(select metrics from general),
    'daily',(select jsonb_agg(metrics||jsonb_build_object('date',day) order by day) from daily),
    'villas',coalesce((select jsonb_agg(metrics||jsonb_build_object('villa_id',villa_id) order by villa_id collate "C") from villas),'[]'::jsonb)
  ) into result;
  if jsonb_array_length(result->'villas')>10000 or octet_length(result::text)>3145728 then raise exception 'REPORT_TOO_LARGE'; end if;
  if exists(select 1 from jsonb_each(result->'totals') m where (m.value::text)::numeric>9007199254740991) then raise exception 'REPORT_TOO_LARGE'; end if;
  return result;
end $$;

create or replace function private.analytics_prune_events(p_site_id text,p_batch_size integer default 10000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz := now()-interval '180 days'; removed integer;
begin
  perform private.analytics_initialize(p_site_id);
  if p_batch_size is null or p_batch_size not between 1 and 10000 then raise exception 'INVALID_BATCH'; end if;
  -- Hold the singleton lock so concurrent cleanup cannot move its watermark inconsistently.
  perform 1 from public.analytics_metadata where singleton for update;
  delete from public.analytics_events where event_id in (
    select event_id from public.analytics_events where site_id=p_site_id and occurred_at<cutoff order by occurred_at limit p_batch_size for update
  ) and site_id=p_site_id and occurred_at<cutoff;
  get diagnostics removed=row_count;
  update public.analytics_metadata set data_available_from=greatest(data_available_from,cutoff) where singleton and site_id=p_site_id;
  return jsonb_build_object('removed',removed,'data_available_from',(select data_available_from from public.analytics_metadata where singleton));
end $$;

create or replace function public.analytics_initialize(p_site_id text) returns timestamptz language sql security invoker set search_path='' as $$ select private.analytics_initialize(p_site_id) $$;
create or replace function public.analytics_insert_event(p_event jsonb,p_site_id text) returns text language sql security invoker set search_path='' as $$ select private.analytics_insert_event(p_event,p_site_id) $$;
create or replace function public.analytics_report(p_query jsonb,p_site_id text) returns jsonb language sql security invoker set search_path='' as $$ select private.analytics_report(p_query,p_site_id) $$;
create or replace function public.analytics_prune_events(p_site_id text,p_batch_size integer default 10000) returns jsonb language sql security invoker set search_path='' as $$ select private.analytics_prune_events(p_site_id,p_batch_size) $$;
revoke all on function private.analytics_initialize(text),private.analytics_insert_event(jsonb,text),private.analytics_report(jsonb,text),private.analytics_prune_events(text,integer),private.analytics_metrics(bigint,bigint,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.analytics_initialize(text),public.analytics_insert_event(jsonb,text),public.analytics_report(jsonb,text),public.analytics_prune_events(text,integer) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.analytics_initialize(text),private.analytics_insert_event(jsonb,text),private.analytics_report(jsonb,text),private.analytics_prune_events(text,integer) to service_role;
grant execute on function public.analytics_initialize(text),public.analytics_insert_event(jsonb,text),public.analytics_report(jsonb,text),public.analytics_prune_events(text,integer) to service_role;
notify pgrst,'reload schema';
commit;
