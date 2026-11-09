-- RANDOM BOX PHASE 2
-- Run this migration in Supabase SQL Editor after the initial schema.

-- Public realtime visibility for draw events; card data remains governed by active-box checks.
drop policy if exists "Public view active box draws" on public.draws;
create policy "Public view active box draws"
on public.draws for select
to anon, authenticated
using (
  participant_id is null
  and exists (
    select 1
    from public.rounds r
    join public.boxes b on b.id = r.box_id
    where r.id = draws.round_id and b.is_active = true
  )
);

-- Read draw history for a public box. Individual mode only returns the caller's participant key.
create or replace function public.get_draw_history(
  p_slug text,
  p_participant_key uuid default null
)
returns table (
  draw_id uuid,
  card_id uuid,
  title text,
  description text,
  image_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.boxes%rowtype;
  v_round_id uuid;
  v_participant_id uuid;
begin
  select * into v_box from public.boxes
  where slug = p_slug and is_active = true;

  if not found then raise exception 'Box not found or inactive'; end if;

  select id into v_round_id from public.rounds
  where box_id = v_box.id and status = 'active'
  order by round_number desc limit 1;

  if v_round_id is null then return; end if;

  if v_box.draw_mode = 'individual' then
    if p_participant_key is null then return; end if;
    select id into v_participant_id from public.participants
    where box_id = v_box.id and participant_key = p_participant_key;
    if v_participant_id is null then return; end if;
  end if;

  return query
  select d.id, c.id, c.title, c.description, c.image_url, d.created_at
  from public.draws d
  join public.cards c on c.id = d.card_id
  where d.round_id = v_round_id
    and (
      (v_box.draw_mode = 'shared' and d.participant_id is null)
      or
      (v_box.draw_mode = 'individual' and d.participant_id = v_participant_id)
    )
  order by d.created_at desc;
end;
$$;

-- Start a fresh round for shared mode, or clear one participant's draws for individual mode.
create or replace function public.reset_box_round(
  p_slug text,
  p_participant_key uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.boxes%rowtype;
  v_round_id uuid;
  v_next integer;
  v_participant_id uuid;
begin
  select * into v_box from public.boxes
  where slug = p_slug and is_active = true
  for update;

  if not found then raise exception 'Box not found or inactive'; end if;

  select id into v_round_id from public.rounds
  where box_id = v_box.id and status = 'active'
  order by round_number desc limit 1
  for update;

  if v_box.draw_mode = 'individual' then
    if p_participant_key is null then raise exception 'Participant key required'; end if;
    select id into v_participant_id from public.participants
    where box_id = v_box.id and participant_key = p_participant_key;
    if v_participant_id is not null and v_round_id is not null then
      delete from public.draws
      where round_id = v_round_id and participant_id = v_participant_id;
    end if;
    return true;
  end if;

  if v_round_id is not null then
    update public.rounds set status = 'completed', ended_at = now()
    where id = v_round_id;
  end if;

  select coalesce(max(round_number),0)+1 into v_next
  from public.rounds where box_id = v_box.id;

  insert into public.rounds(box_id,round_number,status)
  values (v_box.id,v_next,'active');

  return true;
end;
$$;

revoke all on function public.get_draw_history(text, uuid) from public;
grant execute on function public.get_draw_history(text, uuid) to anon, authenticated;

revoke all on function public.reset_box_round(text, uuid) from public;
grant execute on function public.reset_box_round(text, uuid) to anon, authenticated;

-- Realtime publication for shared draws.
do $$
begin
  alter publication supabase_realtime add table public.draws;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
