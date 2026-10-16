-- Executed only in the disposable database owned by test-hourly-site-analytics-db.mjs.
begin;
delete from public.analytics_events where site_id in ('hourly-test','other-site');
update public.analytics_metadata set data_available_from='2026-09-01T00:00:00Z' where site_id='hourly-test';
insert into public.analytics_events(event_id,site_id,villa_id,event_name,page_path,occurred_at)
select gen_random_uuid(),'hourly-test',n::text,'page_view','/villas/'||n,'2026-10-01T17:00:00Z'
from generate_series(1,2000) n;
insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,occurred_at)
values(gen_random_uuid(),'hourly-test','66','contact_click','line','/villas/66','2026-10-01T17:00:00Z');
do $$
declare
 q jsonb := '{"contract_version":"1.0","from_date":"2026-10-01","to_date":"2026-10-02","timezone":"Asia/Bangkok","as_of":"2026-10-03T00:00:00Z","villa_id":null}';
 r jsonb; k text; saved timestamptz; pruned jsonb;
begin
 r:=public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'villas')=2000 and (r#>>'{totals,page_views}')::int=2000,'legacy 2000 villas');
 perform pg_temp.check_true((r#>>'{totals,line_clicks}')::int=1,'legacy LINE');
 perform pg_temp.check_true((r#>>'{daily,0,page_views}')::int=0 and (r#>>'{daily,1,page_views}')::int=2000,'legacy Thai midnight');
 foreach k in array array['page_views','phone_clicks','chat_clicks','line_clicks','gallery_opens'] loop
   perform pg_temp.check_true((select sum((v->>k)::bigint) from jsonb_array_elements(r->'daily') v)=(r->'totals'->>k)::bigint,'legacy daily sums '||k);
 end loop;
 r:=public.analytics_report(q||'{"villa_id":"66"}','hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'villas')=1 and (r#>>'{totals,page_views}')::int=1 and (r#>>'{totals,line_clicks}')::int=1,'legacy villa filtering');
 r:=public.analytics_report(q||'{"contract_version":"1.1","granularity":"hour","from_date":"2026-10-02","from_time":"00:00","to_time":"01:00","villa_id":"66"}','hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'villas')=1 and (r#>>'{hourly,0,page_views}')::int=1 and (r#>>'{hourly,0,line_clicks}')::int=1,'hourly villa filtering');
 insert into public.analytics_events(event_id,site_id,villa_id,event_name,page_path,occurred_at)
 select gen_random_uuid(),'hourly-test',n::text,'page_view','/villas/'||n,'2026-10-01T17:00:00Z' from generate_series(2001,10001) n;
 begin perform public.analytics_report(q,'hourly-test'); raise exception 'accepted 10001 villas'; exception when others then if sqlerrm<>'REPORT_TOO_LARGE' then raise; end if; end;
 delete from public.analytics_events where site_id='hourly-test' and villa_id::int>2000;
 select data_available_from into saved from public.analytics_metadata;
 begin perform public.analytics_prune_events('hourly-test',10001); raise exception 'accepted oversized prune'; exception when others then if sqlerrm<>'INVALID_BATCH' then raise; end if; end;
 perform pg_temp.check_true((select data_available_from from public.analytics_metadata)=saved,'invalid prune keeps watermark');
 update public.analytics_events set occurred_at=now()-interval '181 days' where site_id='hourly-test';
 perform public.analytics_prune_events('hourly-test',10000);
 perform pg_temp.check_true((select count(*) from public.analytics_events)=0,'retention removes old events');
 insert into public.analytics_events(event_id,site_id,event_name,page_path,occurred_at)
 values(gen_random_uuid(),'hourly-test','page_view','/',now()-interval '180 days'),
 (gen_random_uuid(),'hourly-test','page_view','/',now()-interval '180 days 1 second');
 pruned:=public.analytics_prune_events('hourly-test',10000);
 perform pg_temp.check_true((pruned->>'removed')::int=1 and (select count(*) from public.analytics_events)=1,'exact retention boundary');
end $$;
rollback;
select pg_temp.check_true((select count(*) from public.analytics_events)=10,'legacy fixture transaction rolled back');
set role anon;
do $$ begin
 begin perform public.analytics_report('{}','hourly-test'); raise exception 'anon report exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
