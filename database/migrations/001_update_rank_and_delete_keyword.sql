-- Create RPC: update_rank_and_delete_keyword
-- Preconditions expected:
--   - target tables have column: slot_sequence (unique per logical slot)
--   - keywords table has primary key id
--   - optional history table: slot_rank_history(slot_status_id, keyword, link_url, current_rank, start_rank, created_at)

create or replace function public.update_rank_and_delete_keyword(
  p_table text,
  p_slot_sequence integer,
  p_keyword text,
  p_link_url text,
  p_current_rank integer,
  p_keyword_id integer
) returns void
language plpgsql
security definer
as $$
declare
  v_id integer;
  v_start_rank integer;
begin
  -- basic validation
  if p_table not in ('slot_status','slot_copangvip','slot_copangapp','slot_copangrank') then
    raise exception 'invalid table: %', p_table;
  end if;

  -- transaction-scoped lock per slot
  perform pg_advisory_xact_lock(('x'||substr(md5(p_table||':'||p_slot_sequence),1,16))::bit(64)::bigint);

  -- fetch target row id and current start_rank
  execute format('select id, start_rank from %I where slot_sequence = $1', p_table)
    into v_id, v_start_rank
    using p_slot_sequence;

  if v_id is null then
    raise exception 'no target row for % slot_sequence=%', p_table, p_slot_sequence;
  end if;

  -- set start_rank if empty
  if v_start_rank is null or v_start_rank = 0 then
    execute format('update %I set start_rank = $1 where id = $2', p_table)
      using p_current_rank, v_id;
  end if;

  -- update current_rank
  execute format('update %I set current_rank = $1, updated_at = now() where id = $2', p_table)
    using p_current_rank, v_id;

  -- optional: append to common history table if exists
  begin
    perform 1 from information_schema.tables where table_schema='public' and table_name='slot_rank_history';
    if found then
      insert into public.slot_rank_history(slot_status_id, keyword, link_url, current_rank, start_rank, created_at)
      values (v_id, p_keyword, p_link_url, p_current_rank, coalesce(v_start_rank, p_current_rank), now());
    end if;
  exception when others then
    -- ignore history failures to not block main update
    null;
  end;

  -- delete processed keyword
  delete from public.keywords where id = p_keyword_id;
end;
$$;


