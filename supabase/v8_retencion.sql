-- Constelación × · v8 (Repaso del día, racha de días, constelación de la clase)
-- Pegar completo en Supabase → SQL Editor → New query → Run.
-- Es aditivo: no borra datos y se puede correr varias veces.

-- 1) Las partidas pueden ser de tipo "rev" (Repaso del día).
alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions add constraint sessions_mode_check check (mode in ('round', 'inf', 'rev'));

-- 2) student_sync ahora también devuelve los minutos por día y la constelación de la clase.
create or replace function public.student_sync(p_token text, p_facts jsonb default '{}'::jsonb,
                                               p_sessions jsonb default '[]'::jsonb, p_live jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.students;
  sid uuid;
  k text;
  v jsonb;
  merged jsonb;
  st record;
  tz constant text := 'America/Santo_Domingo';  -- los días se cuentan en hora de República Dominicana
  today date := (now() at time zone 'America/Santo_Domingo')::date;
  wk date;
  days_j jsonb;
  cls record;
begin
  wk := today - (extract(isodow from today)::int - 1);  -- lunes de esta semana
  update public.student_tokens set last_used_at = now()
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  returning student_id into sid;
  if sid is null then raise exception 'sesion_invalida'; end if;
  select * into s from public.students where id = sid;
  if pg_column_size(p_facts) > 60000 or pg_column_size(p_sessions) > 60000 or pg_column_size(p_live) > 600 then
    raise exception 'demasiado_grande';
  end if;

  merged := s.facts;
  for k, v in select * from jsonb_each(coalesce(p_facts, '{}'::jsonb)) loop
    if k ~ '^[masd]([2-9]|10)_([2-9]|10)$' and jsonb_typeof(v) = 'object'
       and (not merged ? k or coalesce((v->>'l')::bigint, 0) > coalesce((merged->k->>'l')::bigint, 0)) then
      merged := jsonb_set(merged, array[k], v, true);
    end if;
  end loop;

  insert into public.sessions (id, student_id, started_at, ended_at, mode, ops, n, correct, fast, avg_ms,
                               new_facts, max_streak, tokens_used, perfect)
  select (x->>'id')::uuid, sid,
         to_timestamp((x->>'s')::bigint / 1000.0), to_timestamp((x->>'e')::bigint / 1000.0),
         case when x->>'mode' in ('inf', 'rev') then x->>'mode' else 'round' end,
         left(regexp_replace(coalesce(x->>'ops', 'm'), '[^masd]', '', 'g'), 4),
         least((x->>'n')::int, 2000), least((x->>'c')::int, 2000), least((x->>'f')::int, 2000),
         least((x->>'ms')::int, 600000), least((x->>'nw')::int, 180),
         least(coalesce((x->>'mk')::int, 0), 2000), least(greatest(coalesce((x->>'tu')::int, 0), 0), 2000),
         coalesce((x->>'pf')::boolean, false) and x->>'mode' <> 'inf'
           and (x->>'n')::int >= 20 and (x->>'c')::int = (x->>'n')::int and coalesce((x->>'tu')::int, 0) = 0
  from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb)) x
  limit 100
  on conflict (id) do nothing;

  update public.students set facts = merged, live = p_live, last_seen_at = now() where id = sid;

  select count(*) filter (where perfect) as perfect_rounds,
         coalesce(sum(tokens_used), 0) as used,
         coalesce(max(correct) filter (where mode = 'inf'), 0) as best_run,
         coalesce(max(max_streak), 0) as best_streak
    into st from public.sessions where student_id = sid;

  -- Minutos por día (todos sus dispositivos), para la meta diaria y la racha de días.
  select coalesce(jsonb_object_agg(d, round(m, 1)), '{}'::jsonb) into days_j
    from (select to_char((started_at at time zone tz)::date, 'YYYY-MM-DD') as d,
                 sum(greatest(0, extract(epoch from (ended_at - started_at)) / 60.0))::numeric as m
            from public.sessions
           where student_id = sid and started_at >= now() - interval '400 days'
           group by 1) t;

  -- Constelación de la clase: solo conteos, nunca nombres.
  select (select count(*) from public.students where tutor_id = s.tutor_id) as n,
         count(distinct x.student_id) filter (where (x.started_at at time zone tz)::date = today) as today_n,
         count(distinct x.student_id::text || (x.started_at at time zone tz)::date::text) as week_n
    into cls
    from public.sessions x join public.students y on y.id = x.student_id
   where y.tutor_id = s.tutor_id and x.started_at >= (wk::timestamp at time zone tz);

  return jsonb_build_object(
    'id', sid, 'username', s.username, 'goal', s.daily_goal_min, 'facts', merged,
    'tokens', 3 + 0.5 * st.perfect_rounds - st.used,
    'best_run', st.best_run, 'best_streak', st.best_streak,
    'days', days_j,
    'class', jsonb_build_object('n', cls.n, 'today', cls.today_n, 'week', cls.week_n, 'wk', to_char(wk, 'YYYY-MM-DD')));
end $$;

revoke all on function public.student_sync(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.student_sync(text, jsonb, jsonb, jsonb) to anon, authenticated;
