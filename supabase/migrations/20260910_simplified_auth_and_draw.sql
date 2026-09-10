-- Migración de Autenticación Simplificada y Notificaciones para Amigo Invisible Fulbito
-- Permite ejecutar las funciones sin depender del token auth.uid() de Supabase Auth.

-- 1. Función para buscar evento por código corto
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
    and e.status != 'closed';
$$;

grant execute on function public.lookup_event_by_code(text) to anon, authenticated;

-- 2. Función para crear evento sin restricciones de RLS/Auth
create or replace function public.create_event_simple(
  p_name text,
  p_gift_type text,
  p_theme text,
  p_budget_min integer,
  p_budget_max integer,
  p_event_date date,
  p_organizer_id uuid,
  p_code text,
  p_preference_count integer,
  p_rules text,
  p_organizer_name text
)
returns table (
  id uuid,
  code text,
  name text,
  gift_type text,
  theme text,
  budget_min integer,
  budget_max integer,
  event_date date,
  rules text,
  preference_count integer,
  status text,
  organizer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.events (
    name, gift_type, theme, budget_min, budget_max, event_date, organizer_id, code, preference_count, rules
  ) values (
    p_name, p_gift_type, p_theme, p_budget_min, p_budget_max, p_event_date, p_organizer_id, upper(trim(p_code)), p_preference_count, p_rules
  )
  returning public.events.id into v_event_id;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v_event_id, p_organizer_id, p_organizer_name, 'organizer')
  on conflict do nothing;

  return query
  select e.id, e.code, e.name, e.gift_type, e.theme, e.budget_min, e.budget_max, e.event_date, e.rules, e.preference_count, e.status, e.organizer_id
  from public.events e
  where e.id = v_event_id;
end;
$$;

grant execute on function public.create_event_simple to anon, authenticated;

-- 3. Función para unirse a un evento
create or replace function public.join_event_simple(
  p_code text,
  p_user_id uuid,
  p_display_name text
)
returns table (
  id uuid,
  code text,
  name text,
  gift_type text,
  theme text,
  budget_min integer,
  budget_max integer,
  event_date date,
  rules text,
  preference_count integer,
  status text,
  organizer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select e.id into v_event_id
  from public.events e
  where upper(e.code) = upper(trim(p_code))
  limit 1;

  if v_event_id is null then
    raise exception 'No se encontró un evento con el código %', p_code;
  end if;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v_event_id, p_user_id, p_display_name, 'participant')
  on conflict (event_id, user_id) do update set display_name = p_display_name;

  return query
  select e.id, e.code, e.name, e.gift_type, e.theme, e.budget_min, e.budget_max, e.event_date, e.rules, e.preference_count, e.status, e.organizer_id
  from public.events e
  where e.id = v_event_id;
end;
$$;

grant execute on function public.join_event_simple to anon, authenticated;

-- 4. Función para guardar preferencias
create or replace function public.save_preferences_simple(
  p_event_id uuid,
  p_user_id uuid,
  p_pref1 text,
  p_pref2 text,
  p_pref3 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.preferences where event_id = p_event_id and user_id = p_user_id;

  if trim(p_pref1) != '' then
    insert into public.preferences (event_id, user_id, position, value) values (p_event_id, p_user_id, 1, trim(p_pref1));
  end if;
  if trim(p_pref2) != '' then
    insert into public.preferences (event_id, user_id, position, value) values (p_event_id, p_user_id, 2, trim(p_pref2));
  end if;
  if trim(p_pref3) != '' then
    insert into public.preferences (event_id, user_id, position, value) values (p_event_id, p_user_id, 3, trim(p_pref3));
  end if;
end;
$$;

grant execute on function public.save_preferences_simple to anon, authenticated;

-- 5. Función para obtener el progreso del evento
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
  v_required integer;
  v_status text;
begin
  select e.preference_count, e.status
  into v_required, v_status
  from public.events e
  where e.id = p_event_id;

  if v_required is null then
    v_required := 3;
  end if;

  return query
  select
    count(*)::integer as total_members,
    count(*) filter (
      where (
        select count(distinct p.position)
        from public.preferences p
        where p.event_id = p_event_id and p.user_id = m.user_id
      ) >= v_required
    )::integer as completed_members,
    coalesce(v_status, 'open') as status
  from public.event_members m
  where m.event_id = p_event_id;
end;
$$;

grant execute on function public.get_event_progress(uuid) to anon, authenticated;

-- 6. Función para obtener la asignación secreta de un usuario por su user_id
create or replace function public.get_my_assignment(p_event_id uuid, p_user_id uuid)
returns table (
  recipient_name text,
  preferences text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    m.display_name as recipient_name,
    coalesce(
      array_agg(p.value order by p.position) filter (where p.value is not null),
      '{}'::text[]
    ) as preferences
  from public.assignments a
  join public.event_members m
    on m.event_id = a.event_id and m.user_id = a.recipient_user_id
  left join public.preferences p
    on p.event_id = a.event_id and p.user_id = a.recipient_user_id
  where a.event_id = p_event_id
    and a.giver_user_id = p_user_id
  group by m.display_name;
end;
$$;

grant execute on function public.get_my_assignment(uuid, uuid) to anon, authenticated;

-- 7. Función para ejecutar el sorteo secreto sin atarse a auth.uid()
create or replace function public.run_secret_draw(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members uuid[];
  v_count integer;
  v_shuffled uuid[];
  v_valid boolean := false;
  v_attempts integer := 0;
  i integer;
begin
  select array_agg(user_id) into v_members
  from public.event_members
  where event_id = p_event_id;

  v_count := array_length(v_members, 1);

  if v_count is null or v_count < 2 then
    raise exception 'Se necesitan al menos 2 participantes para realizar el sorteo.';
  end if;

  while not v_valid and v_attempts < 100 loop
    v_attempts := v_attempts + 1;
    v_valid := true;
    
    select array_agg(u order by random()) into v_shuffled
    from unnest(v_members) as u;

    for i in 1..v_count loop
      if v_members[i] = v_shuffled[i] then
        v_valid := false;
        exit;
      end if;
    end loop;
  end loop;

  if not v_valid then
    raise exception 'No se pudo generar un sorteo válido. Reintentá nuevamente.';
  end if;

  delete from public.assignments where event_id = p_event_id;

  for i in 1..v_count loop
    insert into public.assignments (event_id, giver_user_id, recipient_user_id)
    values (p_event_id, v_members[i], v_shuffled[i]);
  end loop;

  update public.events
  set status = 'drawn'
  where id = p_event_id;
end;
$$;

grant execute on function public.run_secret_draw(uuid) to anon, authenticated;
