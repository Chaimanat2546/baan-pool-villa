create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION: %',message; end if; end $$;
select private.analytics_initialize('hourly-test');
update public.analytics_metadata set data_available_from='2026-09-01T00:00:00Z';
insert into public.analytics_events(event_id,site_id,event_name,page_path,occurred_at)
select gen_random_uuid(),'hourly-test','page_view','/',t::timestamptz from unnest(array[
 '2026-10-01T01:59:59.999Z','2026-10-01T02:00:00Z','2026-10-01T02:59:59.999Z',
 '2026-10-01T03:00:00Z','2026-10-01T10:59:59.999Z','2026-10-01T11:00:00Z',
 '2026-10-01T16:59:59.999Z','2026-10-01T17:00:00Z']) t;
insert into public.analytics_events(event_id,site_id,villa_id,event_name,channel,page_path,occurred_at)
values(gen_random_uuid(),'hourly-test','66','contact_click','line','/villas/66','2026-10-01T02:30:00Z'),
 (gen_random_uuid(),'other-site',null,'page_view',null,'/','2026-10-01T02:30:00Z');
do $$
declare
 q jsonb := '{"contract_version":"1.1","granularity":"hour","from_date":"2026-10-01","to_date":"2026-10-01","from_time":"09:00","to_time":"18:00","timezone":"Asia/Bangkok","as_of":"2026-10-02T00:00:00.000Z","villa_id":null}';
 r jsonb; legacy jsonb; k text; actual bigint;
begin
 r := public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true(r->>'contract_version'='1.1','version');
 perform pg_temp.check_true(jsonb_array_length(r->'hourly')=9,'nine hourly buckets');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=4,'half-open boundaries and tenant');
 perform pg_temp.check_true((r#>>'{hourly,0,page_views}')::int=2,'first hour');
 perform pg_temp.check_true((r#>>'{hourly,8,page_views}')::int=1,'last hour');
 foreach k in array array['page_views','phone_clicks','chat_clicks','line_clicks','gallery_opens'] loop
   select sum((v->>k)::bigint) into actual from jsonb_array_elements(r->'hourly') v;
   perform pg_temp.check_true(actual=(r->'totals'->>k)::bigint,'hourly sums '||k);
   perform pg_temp.check_true((r#>>array['daily','0',k])::bigint=actual,'daily sums '||k);
   select coalesce(sum((v->>k)::bigint),0)+(r->'unattributed'->>k)::bigint into actual from jsonb_array_elements(r->'villas') v;
   perform pg_temp.check_true(actual=(r->'totals'->>k)::bigint,'villa sums '||k);
 end loop;
 r := public.analytics_report(q||'{"from_time":"23:00","to_time":"24:00"}','hourly-test');
 perform pg_temp.check_true((r#>>'{totals,page_views}')::int=1,'24:00 excludes tomorrow');
 r := public.analytics_report(q||'{"as_of":"2026-10-01T03:30:00.000Z"}','hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'hourly')=2 and (r#>>'{totals,page_views}')::int=3,'snapshot clips data');
 r := public.analytics_report(q||'{"as_of":"2026-10-01T03:00:00.000Z"}','hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'hourly')=1 and (r#>>'{totals,page_views}')::int=2,'exact snapshot excludes new bucket');
 r := public.analytics_report(q||'{"as_of":"2026-10-01T01:00:00.000Z"}','hourly-test');
 perform pg_temp.check_true(jsonb_array_length(r->'hourly')=0 and (r#>>'{totals,page_views}')::int=0,'future selection');
 update public.analytics_metadata set data_available_from='2026-10-01T02:30:00Z';
 r := public.analytics_report(q,'hourly-test');
 perform pg_temp.check_true((r#>>'{coverage,range_complete}')::boolean=false,'partial coverage hour');
 r := public.analytics_report(q||'{"from_time":"10:00"}','hourly-test');
 perform pg_temp.check_true((r#>>'{coverage,range_complete}')::boolean=true,'complete later hour');
 legacy := public.analytics_report((q - array['granularity','from_time','to_time'])||'{"contract_version":"1.0"}','hourly-test');
 perform pg_temp.check_true(legacy->>'contract_version'='1.0' and not legacy?'hourly' and (legacy#>>'{totals,page_views}')::int=7,'legacy unchanged');
 begin perform public.analytics_report(q||'{"from_time":"09:30"}','hourly-test'); raise exception 'accepted malformed time'; exception when others then if sqlerrm='accepted malformed time' then raise; end if; end;
 begin perform public.analytics_report(q||'{"to_date":"2026-10-02"}','hourly-test'); raise exception 'accepted multiple days'; exception when others then if sqlerrm='accepted multiple days' then raise; end if; end;
 begin perform public.analytics_report(q||'{"site_id":"forged"}','hourly-test'); raise exception 'accepted extra field'; exception when others then if sqlerrm='accepted extra field' then raise; end if; end;
 begin perform public.analytics_report(q,'wrong-site'); raise exception 'accepted wrong identity'; exception when others then if sqlerrm='accepted wrong identity' then raise; end if; end;
 begin perform public.analytics_report(q||'{"as_of":"2026-10-01T24:00:00Z"}','hourly-test'); raise exception 'accepted noncanonical snapshot'; exception when others then if sqlerrm='accepted noncanonical snapshot' then raise; end if; end;
end $$;
set role service_role;
select public.analytics_report('{"contract_version":"1.1","granularity":"hour","from_date":"2026-10-01","to_date":"2026-10-01","from_time":"09:00","to_time":"18:00","timezone":"Asia/Bangkok","as_of":"2026-10-02T00:00:00Z","villa_id":null}','hourly-test')->>'contract_version';
do $$ begin
 begin perform 1 from public.analytics_events; raise exception 'raw events exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform public.analytics_report('{}','hourly-test'); raise exception 'report exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
