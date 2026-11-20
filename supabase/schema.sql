-- Constelación ×: base de datos para Supabase.
-- Pegar completo una sola vez en Supabase → SQL Editor → New query → Run.
-- Se puede volver a correr sin perder datos.

create extension if not exists pgcrypto;

-- Código de 6 caracteres sin letras confusas (sin I, O, 0, 1).
create or replace function public.gen_code() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

-- Tutores: cada uno tiene un código de clase que los niños usan al crear su cuenta.
create table if not exists public.tutors (
  id          uuid primary key references auth.users(id) on delete cascade,
  class_code  text not null unique default public.gen_code(),
  created_at  timestamptz not null default now()
);

-- Estudiantes: solo usuario y lo que juegan. Sin correo ni datos personales.
create table if not exists public.students (
  id             uuid primary key default gen_random_uuid(),
  tutor_id       uuid not null references public.tutors(id) on delete cascade,
  username       text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  real_name      text check (char_length(real_name) <= 40),  -- nota privada del tutor
  daily_goal_min int  not null default 10 check (daily_goal_min between 1 and 120),
  facts          jsonb not null default '{}'::jsonb,
  live           jsonb,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- Contraseñas y sesiones: nadie las puede leer directamente, solo las funciones de abajo.
create table if not exists public.student_auth (
  student_id    uuid primary key references public.students(id) on delete cascade,
  pass_hash     text not null,
  failed        int not null default 0,
  locked_until  timestamptz
);
create table if not exists public.student_tokens (
  token_hash    text primary key,
  student_id    uuid not null references public.students(id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key,
  student_id   uuid not null references public.students(id) on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  mode         text not null default 'round' check (mode in ('round', 'inf')),
  ops          text not null default 'm',
  n            int not null,
  correct      int not null,
  fast         int not null,
  avg_ms       int not null,
  new_facts    int not null,
  max_streak   int not null default 0,
  tokens_used  int not null default 0,
  perfect      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists sessions_student_started on public.sessions (student_id, started_at desc);

alter table public.tutors         enable row level security;
alter table public.students       enable row level security;
alter table public.student_auth   enable row level security;
alter table public.student_tokens enable row level security;
alter table public.sessions       enable row level security;

drop policy if exists tutors_self on public.tutors;
create policy tutors_self on public.tutors for select to authenticated using (id = auth.uid());

drop policy if exists students_tutor on public.students;
drop policy if exists students_tutor_read on public.students;
drop policy if exists students_tutor_update on public.students;
drop policy if exists students_tutor_delete on public.students;
create policy students_tutor_read   on public.students for select to authenticated using (tutor_id = auth.uid());
create policy students_tutor_update on public.students for update to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
create policy students_tutor_delete on public.students for delete to authenticated using (tutor_id = auth.uid());

drop policy if exists sessions_tutor_read on public.sessions;
create policy sessions_tutor_read on public.sessions for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.tutor_id = auth.uid()));

-- ---------- Tutor ----------
create or replace function public.tutor_class_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  insert into public.tutors (id) values (auth.uid()) on conflict (id) do nothing;
  select class_code into c from public.tutors where id = auth.uid();
  return c;
end $$;

create or replace function public.tutor_reset_password(p_student uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.students where id = p_student and tutor_id = auth.uid()) then
    raise exception 'no_permitido';
  end if;
  if char_length(p_password) < 4 then raise exception 'clave_corta'; end if;
  update public.student_auth set pass_hash = crypt(p_password, gen_salt('bf', 8)), failed = 0, locked_until = null
   where student_id = p_student;
  delete from public.student_tokens where student_id = p_student;
end $$;

-- ---------- Estudiante ----------
create or replace function public._new_token(p_student uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  insert into public.student_tokens (token_hash, student_id) values (encode(digest(t, 'sha256'), 'hex'), p_student);
  return t;
end $$;

create or replace function public.student_register(p_class_code text, p_username text, p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; sid uuid; u text := lower(trim(p_username));
begin
  select id into tid from public.tutors where class_code = upper(trim(p_class_code));
  if tid is null then raise exception 'clase_invalida'; end if;
  if u !~ '^[a-z0-9_.]{3,20}$' then raise exception 'usuario_invalido'; end if;
  if char_length(p_password) < 4 or char_length(p_password) > 72 then raise exception 'clave_corta'; end if;
  if exists (select 1 from public.students where username = u) then raise exception 'usuario_existe'; end if;
  insert into public.students (tutor_id, username) values (tid, u) returning id into sid;
  insert into public.student_auth (student_id, pass_hash) values (sid, crypt(p_password, gen_salt('bf', 8)));
  return public._new_token(sid);
end $$;

create or replace function public.student_login(p_username text, p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a public.student_auth; sid uuid;
begin
  select id into sid from public.students where username = lower(trim(p_username));
  if sid is null then raise exception 'credenciales'; end if;
  select * into a from public.student_auth where student_id = sid;
  if a.locked_until is not null and a.locked_until > now() then raise exception 'bloqueado'; end if;
  if a.pass_hash <> crypt(p_password, a.pass_hash) then
    update public.student_auth
       set failed = failed + 1,
           locked_until = case when failed + 1 >= 8 then now() + interval '10 minutes' else null end
     where student_id = sid;
    raise exception 'credenciales';
  end if;
  update public.student_auth set failed = 0, locked_until = null where student_id = sid;
  return public._new_token(sid);
end $$;

create or replace function public.student_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.student_tokens where token_hash = encode(digest(p_token, 'sha256'), 'hex')
$$;

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
begin
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
         case when x->>'mode' = 'inf' then 'inf' else 'round' end,
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

  return jsonb_build_object(
    'id', sid, 'username', s.username, 'goal', s.daily_goal_min, 'facts', merged,
    'tokens', 3 + 0.5 * st.perfect_rounds - st.used,
    'best_run', st.best_run, 'best_streak', st.best_streak);
end $$;

revoke all on function public.tutor_class_code() from public, anon;
revoke all on function public.tutor_reset_password(uuid, text) from public, anon;
revoke all on function public._new_token(uuid) from public, anon, authenticated;
revoke all on function public.student_register(text, text, text) from public;
revoke all on function public.student_login(text, text) from public;
revoke all on function public.student_logout(text) from public;
revoke all on function public.student_sync(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.tutor_class_code() to authenticated;
grant execute on function public.tutor_reset_password(uuid, text) to authenticated;
grant execute on function public.student_register(text, text, text) to anon, authenticated;
grant execute on function public.student_login(text, text) to anon, authenticated;
grant execute on function public.student_logout(text) to anon, authenticated;
grant execute on function public.student_sync(text, jsonb, jsonb, jsonb) to anon, authenticated;

-- Tiempo real para el panel del tutor.
do $$
begin
  begin alter publication supabase_realtime add table public.students; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sessions; exception when duplicate_object then null; end;
end $$;
