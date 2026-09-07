-- Secure helper RPCs used by the web app.
-- Applied to the connected Supabase project as part of this version.

create or replace function public.lookup_event_by_code(p_code text)
returns table (
  id uuid,
  name text,
  gift_type text,
  theme text,
  event_date date,
  rules text,
  preference_count integer,
  status text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.name, e.gift_type, e.theme, e.event_date, e.rules, e.preference_count, e.status
  from public.events e
  where upper(e.code) = upper(trim(p_code))
    and e.status = 'open';
$$;

grant execute on function public.lookup_event_by_code(text) to authenticated;
revoke execute on function public.lookup_event_by_code(text) from anon;

create or replace function public.get_event_progress(p_event_id uuid)
returns table (
  total_members integer,
  completed_members integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_required integer;
  v_status text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  select e.preference_count, e.status
  into v_required, v_status
  from public.events e
  where e.id = p_event_id
    and e.organizer_id = v_uid;

  if v_required is null then raise exception 'not organizer'; end if;

  return query
  select
    count(*)::integer,
    count(*) filter (
      where (
        select count(distinct p.position)
        from public.preferences p
        where p.event_id = p_event_id and p.user_id = m.user_id
      ) >= v_required
    )::integer,
    v_status
  from public.event_members m
  where m.event_id = p_event_id;
end;
$$;

grant execute on function public.get_event_progress(uuid) to authenticated;
revoke execute on function public.get_event_progress(uuid) from anon;

create or replace function public.get_my_assignment(p_event_id uuid)
returns table (
  recipient_name text,
  preferences text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  return query
  select
    m.display_name,
    coalesce(
      array_agg(p.value order by p.position) filter (where p.value is not null),
      '{}'::text[]
    )
  from public.assignments a
  join public.event_members m
    on m.event_id = a.event_id and m.user_id = a.recipient_user_id
  left join public.preferences p
    on p.event_id = a.event_id and p.user_id = a.recipient_user_id
  where a.event_id = p_event_id
    and a.giver_user_id = v_uid
  group by m.display_name;
end;
$$;

grant execute on function public.get_my_assignment(uuid) to authenticated;
revoke execute on function public.get_my_assignment(uuid) from anon;
