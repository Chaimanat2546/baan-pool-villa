begin;
delete from public.analytics_events;
update public.analytics_metadata set data_available_from='2026-09-01T00:00:00Z';
insert into public.analytics_events(event_id,site_id,villa_id,event_name,page_path,occurred_at)
select gen_random_uuid(),'hourly-test',case when h='09:00:00' then '66' else null end,'page_view',case when h='09:00:00' then '/villas/66' else '/' end,
 (d||'T'||h||'+07:00')::timestamptz
from unnest(array['2026-10-12','2026-10-13','2026-10-14']) d
cross join unnest(array['08:59:59.999999','09:00:00','17:59:59.999999','18:00:00','23:00:00','23:59:59.999999']) h;

do $$
declare
 q jsonb := '{"contract_version":"1.2","granularity":"day","from_date":"2026-10-12","to_date":"2026-10-14","from_time":"09:00","to_time":"18:00","timezone":"Asia/Bangkok","as_of":"2026-10-15T00:00:00.000Z","villa_id":null}';
 r jsonb; k text; n bigint;
begin
 r := public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true(r->>'contract_version'='1.2' and r->'query'=q and not r?'hourly','1.2 echo without hourly');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=6,'exclude outside hours on ALL days');
 perform pg_temp.check_true((select jsonb_agg(x->'page_views') from jsonb_array_elements(r->'daily') x)='[2,2,2]'::jsonb,'three filtered daily points');
 perform pg_temp.check_true((r#>>'{unattributed,page_views}')::int=3 and (r#>>'{villas,0,page_views}')::int=3,'attributed plus unattributed');
 r := public.analytics_report(q||'{"villa_id":"66"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=3 and (r#>>'{unattributed,page_views}')::int=0,'villa filter');
 r := public.analytics_report(q||'{"from_time":"23:00","to_time":"24:00"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=6,'end24 every day without wrap');
 r := public.analytics_report(q||'{"as_of":"2026-10-14T01:30:00Z"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=4 and (r#>>'{daily,2,page_views}')::int=0,'before todays window');
 r := public.analytics_report(q||'{"as_of":"2026-10-14T04:30:00Z"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=5,'clip ongoing window');
 r := public.analytics_report(q||'{"as_of":"2026-10-14T11:00:00Z"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=6,'end boundary excluded');
 update public.analytics_metadata set data_available_from='2026-10-12T01:59:59.999999Z';
 r := public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true((r#>>'{coverage,range_complete}')::boolean,'retention before start');
 update public.analytics_metadata set data_available_from='2026-10-12T02:00:00.000001Z';
 r := public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true(not (r#>>'{coverage,range_complete}')::boolean,'microsecond retention after start');
 update public.analytics_metadata set data_available_from='2026-09-01T00:00:00Z';
 insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,occurred_at)
 select gen_random_uuid(),'hourly-test','66',case when c='gallery' then 'gallery_open' else 'contact_click' end,case when c='gallery' then null else c end,'/villas/66','2026-10-13T03:00:00Z' from unnest(array['phone','line','chat','gallery']) c;
 r := public.analytics_report(q,'hourly-test');
 foreach k in array array['page_views','phone_clicks','chat_clicks','line_clicks','gallery_opens'] loop
   select sum((x->>k)::bigint) into n from jsonb_array_elements(r->'daily') x;
   perform pg_temp.check_true(n=(r#>>array['totals',k])::bigint,'daily sums '||k);
   select coalesce(sum((x->>k)::bigint),0) into n from jsonb_array_elements(r->'villas') x;
   perform pg_temp.check_true(n+(r#>>array['unattributed',k])::bigint=(r#>>array['totals',k])::bigint,'villa sums '||k);
 end loop;
 begin perform public.analytics_report(q||'{"from_time":"09:30"}','hourly-test'); raise exception 'accepted malformed'; exception when others then if sqlerrm='accepted malformed' then raise; end if; end;
 begin perform public.analytics_report(q||'{"granularity":"hour"}','hourly-test'); raise exception 'accepted grain'; exception when others then if sqlerrm='accepted grain' then raise; end if; end;
 begin perform public.analytics_report(q||'{"site_id":"forged"}','hourly-test'); raise exception 'accepted extra'; exception when others then if sqlerrm='accepted extra' then raise; end if; end;
 begin perform public.analytics_report(q,'wrong-site'); raise exception 'accepted identity'; exception when others then if sqlerrm='accepted identity' then raise; end if; end;
end $$;
set role service_role;
select public.analytics_report('{"contract_version":"1.2","granularity":"day","from_date":"2026-10-12","to_date":"2026-10-12","from_time":"09:00","to_time":"18:00","timezone":"Asia/Bangkok","as_of":"2026-10-15T00:00:00Z","villa_id":null}','hourly-test')->>'contract_version';
reset role;
set role authenticated;
do $$ begin
 begin perform public.analytics_report('{}','hourly-test'); raise exception 'report exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
