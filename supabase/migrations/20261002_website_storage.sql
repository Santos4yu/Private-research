-- Preparation only. Does not change authentication tables or enable cutover.
-- Run as the project's database owner. Never expose website_private via REST.
begin;
create schema if not exists website_private;
revoke all on schema website_private from public, anon, authenticated;

create table if not exists website_private.storage (
  key text primary key check (octet_length(key) between 1 and 1024),
  kind text not null check (kind in ('string', 'hash', 'list', 'zset')),
  value jsonb not null,
  expires_at timestamptz,
  check ((kind = 'string' and jsonb_typeof(value) = 'string') or
         (kind = 'hash' and jsonb_typeof(value) = 'object') or
         (kind = 'zset' and jsonb_typeof(value) = 'object') or
         (kind = 'list' and jsonb_typeof(value) = 'array'))
);
create index if not exists storage_expiry on website_private.storage(expires_at)
  where expires_at is not null;
create table if not exists website_private.migration (
  id boolean primary key default true check (id),
  ready boolean not null default false,
  source text,
  verified_at timestamptz
);
insert into website_private.migration(id) values(true) on conflict do nothing;
alter table website_private.storage enable row level security;
alter table website_private.migration enable row level security;
revoke all on website_private.storage, website_private.migration from public, anon, authenticated, service_role;

create or replace function public.website_storage_pipeline(commands jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c jsonb; op text; k text; field text; text_value text; option_name text;
  rec website_private.storage%rowtype;
  out_value jsonb; results jsonb := '[]'::jsonb;
  data jsonb; expiry timestamptz; ttl bigint; n bigint; i integer;
  first_index integer; last_index integer; length integer;
  nx boolean; xx boolean; key_exists boolean;
  score double precision; min_score double precision; max_score double precision;
begin
  if jsonb_typeof(commands) is distinct from 'array' or jsonb_array_length(commands) not between 1 and 128
     or octet_length(commands::text) > 16777216 then
    raise exception 'website_storage_invalid_batch';
  end if;
  -- Bounded transactions share a lock: counters, NX leases, and imports cannot
  -- race. Never hold this lock while contacting an outside sports provider.
  perform pg_advisory_xact_lock(726340021);
  if not exists(select 1 from website_private.migration where id and ready)
     or not exists(select 1 from website_private.storage
                   where key = 'krazy_data:site_controls:v1' and kind = 'string' and expires_at is null)
     or not exists(select 1 from website_private.storage
                   where key = 'krazy_data:member_rules:v1' and kind = 'string' and expires_at is null) then
    raise exception 'website_storage_not_ready';
  end if;
  -- Small incremental cleanup avoids a maintenance job and unbounded scans.
  delete from website_private.storage where key in
    (select key from website_private.storage where expires_at <= statement_timestamp()
     order by expires_at limit 32);
  for c in select value from jsonb_array_elements(commands) loop
    if jsonb_typeof(c) is distinct from 'array' or jsonb_array_length(c) not between 2 and 4096 then
      raise exception 'website_storage_invalid_command';
    end if;
    op := upper(c->>0); k := c->>1;
    if k is null or octet_length(k) not between 1 and 1024 then
      raise exception 'website_storage_invalid_key';
    end if;
    delete from website_private.storage where key = k and expires_at <= statement_timestamp();
    select * into rec from website_private.storage where key = k;
    key_exists := found; out_value := 'null'::jsonb;
    if op in ('GET', 'HGET', 'HGETALL', 'HLEN', 'LRANGE', 'LLEN', 'INCR', 'HSET', 'HSETNX', 'HDEL', 'LPUSH', 'LTRIM', 'ZADD', 'ZRANGEBYSCORE', 'COMPAREDEL')
       and key_exists and rec.kind <> (case when op in ('GET','INCR') then 'string'
          when op = 'COMPAREDEL' then 'string'
          when op in ('ZADD','ZRANGEBYSCORE') then 'zset'
          when op in ('LRANGE','LLEN','LPUSH','LTRIM') then 'list' else 'hash' end) then
      raise exception 'website_storage_wrong_type';
    end if;
    if op = 'GET' then
      out_value := case when key_exists then rec.value else 'null'::jsonb end;
    elsif op = 'MGET' then
      out_value := '[]'::jsonb;
      for i in 1..jsonb_array_length(c)-1 loop
        select value into data from website_private.storage where key = c->>i and kind = 'string'
          and (expires_at is null or expires_at > statement_timestamp());
        out_value := out_value || jsonb_build_array(coalesce(data, 'null'::jsonb));
      end loop;
    elsif op in ('SET', 'SETNX', 'SETEX') then
      expiry := null; nx := op = 'SETNX'; xx := false;
      if op = 'SETEX' then
        if jsonb_array_length(c) <> 4 then raise exception 'website_storage_invalid_set'; end if;
        ttl := (c->>2)::bigint; text_value := c->>3;
        if ttl <= 0 then raise exception 'website_storage_invalid_expiry'; end if;
        expiry := statement_timestamp() + ttl * interval '1 second';
      else
        text_value := c->>2; i := 3;
        while i < jsonb_array_length(c) loop
          option_name := upper(c->>i);
          if option_name in ('EX','PX') then
            ttl := (c->>(i+1))::bigint;
            if ttl is null or ttl <= 0 then raise exception 'website_storage_invalid_expiry'; end if;
            expiry := statement_timestamp() + ttl * case when option_name = 'EX' then interval '1 second' else interval '1 millisecond' end;
            i := i + 2;
          elsif option_name = 'NX' then nx := true; i := i + 1;
          elsif option_name = 'XX' then xx := true; i := i + 1;
          else raise exception 'website_storage_invalid_option'; end if;
        end loop;
      end if;
      if text_value is null or (nx and xx) then raise exception 'website_storage_invalid_set'; end if;
      if not ((nx and key_exists) or (xx and not key_exists)) then
        insert into website_private.storage values(k, 'string', to_jsonb(text_value), expiry)
          on conflict(key) do update set kind = excluded.kind, value = excluded.value, expires_at = excluded.expires_at;
        out_value := '"OK"'::jsonb;
      end if;
    elsif op = 'INCR' then
      n := coalesce(rec.value #>> '{}', '0')::bigint + 1;
      insert into website_private.storage values(k, 'string', to_jsonb(n::text), rec.expires_at)
        on conflict(key) do update set value = excluded.value;
      out_value := to_jsonb(n);
    elsif op = 'EXPIRE' then
      ttl := (c->>2)::bigint;
      if jsonb_array_length(c) > 4 or (jsonb_array_length(c) = 4 and upper(c->>3) not in ('NX','XX')) then
        raise exception 'website_storage_invalid_expiry';
      end if;
      nx := upper(coalesce(c->>3,'')) = 'NX'; xx := upper(coalesce(c->>3,'')) = 'XX';
      out_value := '0'::jsonb;
      if key_exists and not (nx and rec.expires_at is not null) and not (xx and rec.expires_at is null) then
        if ttl <= 0 then delete from website_private.storage where key = k;
        else update website_private.storage set expires_at = statement_timestamp() + ttl * interval '1 second' where key = k;
        end if;
        out_value := '1'::jsonb;
      end if;
    elsif op = 'COMPAREDEL' then
      out_value := '0'::jsonb;
      if key_exists and rec.value #>> '{}' = c->>2 then
        delete from website_private.storage where key = k;
        out_value := '1'::jsonb;
      end if;
    elsif op = 'DEL' then
      n := 0;
      for i in 1..jsonb_array_length(c)-1 loop
        delete from website_private.storage where key = c->>i and (expires_at is null or expires_at > statement_timestamp());
        if found then n := n + 1; end if;
      end loop;
      out_value := to_jsonb(n);
    elsif op in ('HSET','HSETNX') then
      if jsonb_array_length(c) < 4 or jsonb_array_length(c) % 2 <> 0
         or (op = 'HSETNX' and jsonb_array_length(c) <> 4) then
        raise exception 'website_storage_invalid_hash';
      end if;
      data := coalesce(rec.value, '{}'::jsonb); n := 0; i := 2;
      while i < jsonb_array_length(c) loop
        field := c->>i; text_value := c->>(i+1);
        if field is null or text_value is null then raise exception 'website_storage_invalid_hash'; end if;
        if not data ? field then n := n + 1; end if;
        if op <> 'HSETNX' or not data ? field then
          data := jsonb_set(data, array[field], to_jsonb(text_value), true);
        end if;
        i := i + 2;
      end loop;
      insert into website_private.storage values(k, 'hash', data, rec.expires_at)
        on conflict(key) do update set value = excluded.value;
      out_value := to_jsonb(n);
    elsif op = 'HGET' then
      out_value := coalesce(rec.value -> (c->>2), 'null'::jsonb);
    elsif op = 'HGETALL' then
      select coalesce(jsonb_agg(pair.v order by pair.k, pair.pos), '[]'::jsonb) into out_value
        from (select e.key k, x.pos, x.v from jsonb_each(coalesce(rec.value, '{}'::jsonb)) e
          cross join lateral (values(0, to_jsonb(e.key)), (1, e.value)) x(pos,v)) pair;
    elsif op = 'HLEN' then
      select to_jsonb(count(*)) into out_value from jsonb_object_keys(coalesce(rec.value, '{}'::jsonb));
    elsif op = 'HDEL' then
      data := coalesce(rec.value, '{}'::jsonb); n := 0;
      for i in 2..jsonb_array_length(c)-1 loop
        if data ? (c->>i) then data := data - (c->>i); n := n + 1; end if;
      end loop;
      if data = '{}'::jsonb then delete from website_private.storage where key = k;
      else update website_private.storage set value = data where key = k; end if;
      out_value := to_jsonb(n);
    elsif op = 'LPUSH' then
      if jsonb_array_length(c) < 3 then raise exception 'website_storage_invalid_list'; end if;
      data := coalesce(rec.value, '[]'::jsonb);
      for i in 2..jsonb_array_length(c)-1 loop
        data := jsonb_build_array(c->>i) || data;
      end loop;
      insert into website_private.storage values(k, 'list', data, rec.expires_at)
        on conflict(key) do update set value = excluded.value;
      out_value := to_jsonb(jsonb_array_length(data));
    elsif op in ('LRANGE','LTRIM') then
      data := coalesce(rec.value, '[]'::jsonb); length := jsonb_array_length(data);
      first_index := (c->>2)::integer; last_index := (c->>3)::integer;
      if first_index < 0 then first_index := length + first_index; end if;
      if last_index < 0 then last_index := length + last_index; end if;
      select coalesce(jsonb_agg(e.value order by e.pos), '[]'::jsonb) into data
        from jsonb_array_elements(data) with ordinality e(value,pos)
        where e.pos-1 between greatest(0, first_index) and least(length-1, last_index);
      if op = 'LRANGE' then out_value := data;
      else
        if data = '[]'::jsonb then delete from website_private.storage where key = k;
        else update website_private.storage set value = data where key = k; end if;
        out_value := '"OK"'::jsonb;
      end if;
    elsif op = 'LLEN' then
      out_value := to_jsonb(jsonb_array_length(coalesce(rec.value, '[]'::jsonb)));
    elsif op = 'ZADD' then
      if jsonb_array_length(c) < 4 or jsonb_array_length(c) % 2 <> 0 then
        raise exception 'website_storage_invalid_zset';
      end if;
      data := coalesce(rec.value, '{}'::jsonb); n := 0; i := 2;
      while i < jsonb_array_length(c) loop
        score := (c->>i)::double precision; field := c->>(i+1);
        if field is null or score is null or score in ('NaN'::double precision,'Infinity'::double precision,'-Infinity'::double precision) then
          raise exception 'website_storage_invalid_zset';
        end if;
        if not data ? field then n := n + 1; end if;
        data := jsonb_set(data, array[field], to_jsonb(score), true); i := i + 2;
      end loop;
      insert into website_private.storage values(k, 'zset', data, rec.expires_at)
        on conflict(key) do update set value = excluded.value;
      out_value := to_jsonb(n);
    elsif op = 'ZRANGEBYSCORE' then
      min_score := case when c->>2 = '-inf' then '-Infinity'::double precision else (c->>2)::double precision end;
      max_score := case when c->>3 = '+inf' then 'Infinity'::double precision else (c->>3)::double precision end;
      select coalesce(jsonb_agg(to_jsonb(e.key) order by (e.value #>> '{}')::double precision, e.key), '[]'::jsonb)
        into out_value from jsonb_each(coalesce(rec.value, '{}'::jsonb)) e
        where (e.value #>> '{}')::double precision between min_score and max_score;
    elsif op = 'PTTL' then
      out_value := to_jsonb(case when not key_exists then -2 when rec.expires_at is null then -1
        else floor(extract(epoch from (rec.expires_at - statement_timestamp())) * 1000)::bigint end);
    elsif op = 'TYPE' then
      out_value := to_jsonb(case when key_exists then rec.kind else 'none' end);
    else raise exception 'website_storage_unsupported_command';
    end if;
    results := results || jsonb_build_array(jsonb_build_object('result', out_value));
  end loop;
  return results;
end;
$$;

create or replace function public.website_storage_pin_failure()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare reply jsonb; attempts bigint; lock_until double precision;
begin
  reply := public.website_storage_pipeline('[ ["GET", "vortex_v2:admin_pin_lock_until"] ]'::jsonb);
  lock_until := coalesce(reply->0->>'result','0')::double precision;
  if lock_until > extract(epoch from statement_timestamp()) then return '{"result":"OK"}'::jsonb; end if;
  reply := public.website_storage_pipeline('[ ["INCR", "vortex_v2:admin_pin_fail_count"] ]'::jsonb);
  attempts := (reply->0->>'result')::bigint;
  if attempts >= 5 then
    perform public.website_storage_pipeline(jsonb_build_array(
      jsonb_build_array('SET','vortex_v2:admin_pin_lock_until', (extract(epoch from statement_timestamp()) + 900)::text),
      jsonb_build_array('SET','vortex_v2:admin_pin_fail_count','0')));
  end if;
  return '{"result":"OK"}'::jsonb;
end;
$$;
revoke all on function public.website_storage_pipeline(jsonb) from public, anon, authenticated;
revoke all on function public.website_storage_pin_failure() from public, anon, authenticated;
grant execute on function public.website_storage_pipeline(jsonb) to service_role;
grant execute on function public.website_storage_pin_failure() to service_role;
notify pgrst, 'reload schema';
commit;
