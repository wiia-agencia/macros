-- Macros · la parte de usuarios (Supabase / Postgres 17)
--
-- Todo vive en el esquema «ag», que la API no publica: con la clave pública de Supabase no se llega a ninguna tabla.
-- La app solo puede llamar a las funciones public.ag_* de abajo, que comprueban quién llama antes de tocar nada:
--   · entrar ............ ag_mirar, ag_crear_pin, ag_entrar, ag_salir
--   · sus datos ......... ag_sinc (sube y baja lo de quien llama, y de nadie más)
--   · el administrador .. ag_admin_usuarios, ag_admin_invitar, ag_admin_activar, ag_admin_enlace
-- No se guarda en claro ni el código de invitación, ni el PIN, ni la sesión: solo su huella (SHA-256).
-- El archivo se puede volver a pasar entero: no borra nada.

create schema if not exists ag;
comment on schema ag is 'Macros (la app de macros): usuarios, sesiones y lo que apunta cada uno. Solo se toca desde las funciones public.ag_*.';

create sequence if not exists ag.sec;        -- el orden en que el servidor recibe cada cambio: con él, cada móvil pide «lo nuevo desde…»

create table if not exists ag.usuarios (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (char_length(nombre) between 1 and 40),
  codigo_hash     text not null unique,              -- huella del código de invitación
  pin_hash        text,                              -- huella del PIN; sin PIN = invitación sin usar
  admin           boolean not null default false,
  activo          boolean not null default true,
  creado          timestamptz not null default now(),
  caduca          timestamptz,                       -- hasta cuándo vale una invitación sin usar
  visto           timestamptz,                       -- la última vez que su app habló con el servidor
  fallos          integer not null default 0,        -- PIN mal seguidos
  bloqueado_hasta timestamptz
);
create table if not exists ag.sesiones (             -- qué móvil es de quién
  token_hash text primary key,
  usuario    uuid not null references ag.usuarios (id) on delete cascade,
  creada     timestamptz not null default now(),
  vista      timestamptz not null default now()
);
create index if not exists sesiones_usuario on ag.sesiones (usuario);
create table if not exists ag.dias (                 -- un renglón por persona y día
  usuario uuid not null references ag.usuarios (id) on delete cascade,
  dia     date not null,
  comidas jsonb not null default '[]'::jsonb,
  meta    jsonb,                                     -- el objetivo que tenía ese día
  mod     bigint not null,                           -- cuándo se cambió en el móvil (ms): gana el más reciente
  sec     bigint not null,
  primary key (usuario, dia)
);
create index if not exists dias_sec on ag.dias (usuario, sec);
create table if not exists ag.pesos (
  usuario uuid not null references ag.usuarios (id) on delete cascade,
  dia     date not null,
  kg      numeric(5, 1),                             -- sin valor = borrado
  mod     bigint not null,
  sec     bigint not null,
  primary key (usuario, dia)
);
create index if not exists pesos_sec on ag.pesos (usuario, sec);
create table if not exists ag.estado (               -- perfil, objetivo, favoritos, alimentos y platos propios
  usuario uuid primary key references ag.usuarios (id) on delete cascade,
  datos   jsonb not null,
  mod     bigint not null,
  sec     bigint not null
);
alter table ag.usuarios enable row level security;   -- sin ninguna política: aunque alguien llegara al esquema, no vería filas
alter table ag.sesiones enable row level security;
alter table ag.dias     enable row level security;
alter table ag.pesos    enable row level security;
alter table ag.estado   enable row level security;

/* ── Piezas de dentro (no se pueden llamar desde fuera) ─────────────────────────────────────────── */

create or replace function ag.huella(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'utf8')), 'hex');
$$;

-- El código tal como se compara: sin guiones ni espacios y en mayúsculas.
create or replace function ag.limpia(p text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function ag.pin_huella(p_usuario uuid, p_pin text) returns text
language sql immutable set search_path = '' as $$
  select ag.huella(p_usuario::text || ':' || p_pin || ':macros');
$$;

-- 12 letras y números al azar, sin los que se confunden (0 O 1 I L): unos 59 bits.
create or replace function ag.codigo_nuevo() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea; c text := ''; v integer; i integer;
begin
  while char_length(c) < 12 loop
    b := sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'utf8'));
    i := 0;
    while i < 32 and char_length(c) < 12 loop
      v := get_byte(b, i); i := i + 1;
      if v < 248 then c := c || substr(alfabeto, (v % 31) + 1, 1); end if;     -- 248 = 31 × 8: así ninguna letra sale más que otra
    end loop;
  end loop;
  return c;
end $$;

-- Un código que no tenga nadie, ya limpio (12 en mayúsculas).
create or replace function ag.codigo_libre() returns text
language plpgsql volatile set search_path = '' as $$
declare c text;
begin
  loop
    c := ag.codigo_nuevo();
    exit when not exists (select 1 from ag.usuarios where codigo_hash = ag.huella(c));
  end loop;
  return c;
end $$;

-- Como se enseña y se comparte: k7mp-2xwd-9rtn
create or replace function ag.bonito(c text) returns text
language sql immutable set search_path = '' as $$
  select lower(substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4));
$$;

create or replace function ag.token_nuevo() returns text
language sql volatile set search_path = '' as $$
  select encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'utf8')), 'hex');
$$;

-- Da de alta a alguien y devuelve su código de invitación (la única vez que se ve). Vale 7 días si no se usa.
create or replace function ag.alta(p_nombre text, p_admin boolean) returns text
language plpgsql volatile set search_path = '' as $$
declare c text := ag.codigo_libre();
begin
  insert into ag.usuarios (nombre, codigo_hash, admin, caduca)
    values (btrim(p_nombre), ag.huella(c), coalesce(p_admin, false), now() + interval '7 days');
  return ag.bonito(c);
end $$;

-- A quién pertenece un código que todavía vale (activo y, si no tiene PIN, sin caducar).
create or replace function ag.busca(p_codigo text) returns ag.usuarios
language plpgsql stable set search_path = '' as $$
declare u ag.usuarios;
begin
  select * into u from ag.usuarios
   where codigo_hash = ag.huella(ag.limpia(p_codigo)) and activo
     and (pin_hash is not null or caduca is null or caduca > now());
  return u;
end $$;

create or replace function ag.espera(p_hasta timestamptz) returns integer
language sql stable set search_path = '' as $$
  select case when p_hasta is null or p_hasta <= now() then 0 else ceil(extract(epoch from p_hasta - now()))::integer end;
$$;

-- Deja un móvil dentro: crea la sesión y devuelve su llave (solo se guarda la huella).
create or replace function ag.abre_sesion(p_usuario uuid) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare t text := ag.token_nuevo(); u ag.usuarios;
begin
  insert into ag.sesiones (token_hash, usuario) values (ag.huella(t), p_usuario);
  update ag.usuarios set visto = now() where id = p_usuario returning * into u;
  return jsonb_build_object('ok', true, 'token', t, 'usuario', jsonb_build_object('id', u.id, 'nombre', u.nombre, 'admin', u.admin));
end $$;

-- De quién es una sesión (nadie, si no existe, lleva seis meses sin usarse o la persona está desactivada).
create or replace function ag.sesion(p_token text) returns ag.usuarios
language plpgsql volatile set search_path = '' as $$
declare h text := ag.huella(p_token); u ag.usuarios;
begin
  if p_token is null or p_token = '' then return u; end if;
  select us.* into u from ag.sesiones s join ag.usuarios us on us.id = s.usuario
   where s.token_hash = h and us.activo and s.vista > now() - interval '180 days';
  if u.id is null then return u; end if;
  update ag.sesiones set vista = now() where token_hash = h and vista < now() - interval '5 minutes';
  update ag.usuarios set visto = now() where id = u.id and (visto is null or visto < now() - interval '5 minutes');
  return u;
end $$;

/* ── Entrar ─────────────────────────────────────────────────────────────────────────────────────── */

-- ¿Vale este código? Dice de quién es y si toca crear el PIN o escribirlo.
create or replace function public.ag_mirar(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u ag.usuarios := ag.busca(p_codigo);
begin
  if u.id is null then return jsonb_build_object('vale', false); end if;
  return jsonb_build_object('vale', true, 'nombre', u.nombre, 'nuevo', u.pin_hash is null, 'espera', ag.espera(u.bloqueado_hasta));
end $$;

-- La primera vez: crea el PIN (cuatro números) y deja el móvil dentro.
create or replace function public.ag_crear_pin(p_codigo text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios; hecho uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'motivo', 'pin'); end if;
  u := ag.busca(p_codigo);
  if u.id is null then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  update ag.usuarios set pin_hash = ag.pin_huella(u.id, p_pin), caduca = null, fallos = 0, bloqueado_hasta = null
   where id = u.id and pin_hash is null returning id into hecho;
  if hecho is null then return jsonb_build_object('ok', false, 'motivo', 'ya'); end if;      -- ya tenía PIN: el código solo no lo cambia
  return ag.abre_sesion(u.id);
end $$;

-- Desde otro móvil: código y PIN. Al quinto PIN mal, 15 minutos; cada fallo de más lo dobla, hasta un día.
create or replace function public.ag_entrar(p_codigo text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios; f integer; hasta timestamptz;
begin
  select * into u from ag.usuarios
   where codigo_hash = ag.huella(ag.limpia(p_codigo)) and activo
     and (pin_hash is not null or caduca is null or caduca > now())
     for update;                                                           -- los intentos, de uno en uno
  if u.id is null then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  if u.pin_hash is null then return jsonb_build_object('ok', false, 'motivo', 'nuevo'); end if;
  if u.bloqueado_hasta is not null and u.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'espera', ag.espera(u.bloqueado_hasta));
  end if;
  if p_pin is not null and p_pin ~ '^[0-9]{4}$' and u.pin_hash = ag.pin_huella(u.id, p_pin) then
    update ag.usuarios set fallos = 0, bloqueado_hasta = null where id = u.id;
    return ag.abre_sesion(u.id);
  end if;
  f := u.fallos + 1;
  if f >= 5 then
    hasta := now() + least(interval '24 hours', interval '15 minutes' * power(2, least(f - 5, 10)));
    update ag.usuarios set fallos = f, bloqueado_hasta = hasta where id = u.id;
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'espera', ag.espera(hasta));
  end if;
  update ag.usuarios set fallos = f where id = u.id;
  return jsonb_build_object('ok', false, 'motivo', 'pin', 'quedan', 5 - f);
end $$;

create or replace function public.ag_salir(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from ag.sesiones where token_hash = ag.huella(p_token) and p_token is not null and p_token <> '';
  return jsonb_build_object('ok', true);
end $$;

/* ── Sus datos ──────────────────────────────────────────────────────────────────────────────────── */

-- Sube los cambios de este móvil y baja lo nuevo desde p_desde. De cada día, peso o estado se queda el más reciente
-- (por su «mod»); lo que llega más viejo se rechaza y se devuelve lo que hay. Lo recién subido no se devuelve.
--   p_cambios = { dias: [{ d, comidas, meta, mod }], pesos: [{ d, kg, mod }], estado: { datos, mod } }
create or replace function public.ag_sinc(p_token text, p_desde bigint, p_cambios jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  u ag.usuarios;
  c jsonb := coalesce(p_cambios, '{}'::jsonb);
  desde bigint := coalesce(p_desde, 0);
  ahora bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  x jsonb; f date; m bigint; v_kg numeric;
  hechos_d date[] := '{}'; rech_d date[] := '{}'; hechos_p date[] := '{}'; rech_p date[] := '{}';
  est_hecho boolean := false; est_rech boolean := false;
  v_dias jsonb; v_pesos jsonb; v_estado jsonb; v_cursor bigint;
begin
  u := ag.sesion(p_token);
  if u.id is null then return jsonb_build_object('sesion', false); end if;
  if jsonb_typeof(c) is distinct from 'object' then c := '{}'::jsonb; end if;

  -- topes: una llamada no puede traer de todo (la app sube por tandas)
  if jsonb_typeof(c -> 'dias') = 'array' and jsonb_array_length(c -> 'dias') > 80 then raise exception 'demasiado: más de 80 días en una llamada'; end if;
  if jsonb_typeof(c -> 'pesos') = 'array' and jsonb_array_length(c -> 'pesos') > 400 then raise exception 'demasiado: más de 400 pesos en una llamada'; end if;
  if octet_length(coalesce((c -> 'estado')::text, '')) > 300000 then raise exception 'demasiado: el estado pasa de 300 KB'; end if;

  perform 1 from ag.usuarios where id = u.id for update;       -- lo de una misma persona se escribe de uno en uno

  if jsonb_typeof(c -> 'dias') = 'array' then
    for x in select value from jsonb_array_elements(c -> 'dias') loop
      continue when jsonb_typeof(x) is distinct from 'object' or not pg_input_is_valid(coalesce(x ->> 'd', ''), 'date');
      f := (x ->> 'd')::date;
      continue when f < date '2020-01-01' or f > hoy + 2 or jsonb_typeof(x -> 'comidas') is distinct from 'array';
      if octet_length((x -> 'comidas')::text) > 40000 or octet_length(coalesce((x -> 'meta')::text, '')) > 2000 then raise exception 'demasiado: un día pasa de 40 KB'; end if;
      m := case when jsonb_typeof(x -> 'mod') = 'number' then least(greatest(floor((x ->> 'mod')::numeric), 0), ahora + 300000)::bigint else ahora end;
      insert into ag.dias as t (usuario, dia, comidas, meta, mod, sec)
        values (u.id, f, x -> 'comidas', nullif(x -> 'meta', 'null'::jsonb), m, nextval('ag.sec'))
        on conflict (usuario, dia) do update set comidas = excluded.comidas, meta = excluded.meta, mod = excluded.mod, sec = excluded.sec
        where t.mod < excluded.mod;
      if found then hechos_d := hechos_d || f; else rech_d := rech_d || f; end if;
    end loop;
  end if;

  if jsonb_typeof(c -> 'pesos') = 'array' then
    for x in select value from jsonb_array_elements(c -> 'pesos') loop
      continue when jsonb_typeof(x) is distinct from 'object' or not pg_input_is_valid(coalesce(x ->> 'd', ''), 'date');
      f := (x ->> 'd')::date;
      continue when f < date '2020-01-01' or f > hoy + 2;
      if jsonb_typeof(x -> 'kg') = 'number' then
        v_kg := round((x ->> 'kg')::numeric, 1);
        continue when v_kg < 30 or v_kg > 300;
      elsif x -> 'kg' is null or jsonb_typeof(x -> 'kg') = 'null' then
        v_kg := null;                                           -- borrado
      else
        continue;
      end if;
      m := case when jsonb_typeof(x -> 'mod') = 'number' then least(greatest(floor((x ->> 'mod')::numeric), 0), ahora + 300000)::bigint else ahora end;
      insert into ag.pesos as t (usuario, dia, kg, mod, sec) values (u.id, f, v_kg, m, nextval('ag.sec'))
        on conflict (usuario, dia) do update set kg = excluded.kg, mod = excluded.mod, sec = excluded.sec
        where t.mod < excluded.mod;
      if found then hechos_p := hechos_p || f; else rech_p := rech_p || f; end if;
    end loop;
  end if;

  x := c -> 'estado';
  if jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'datos') = 'object' then
    m := case when jsonb_typeof(x -> 'mod') = 'number' then least(greatest(floor((x ->> 'mod')::numeric), 0), ahora + 300000)::bigint else ahora end;
    insert into ag.estado as t (usuario, datos, mod, sec) values (u.id, x -> 'datos', m, nextval('ag.sec'))
      on conflict (usuario) do update set datos = excluded.datos, mod = excluded.mod, sec = excluded.sec
      where t.mod < excluded.mod;
    if found then est_hecho := true; else est_rech := true; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('d', dia::text, 'comidas', comidas, 'meta', meta, 'mod', mod) order by dia), '[]'::jsonb) into v_dias
    from ag.dias where usuario = u.id and ((sec > desde and not (dia = any (hechos_d))) or dia = any (rech_d));
  select coalesce(jsonb_agg(jsonb_build_object('d', dia::text, 'kg', kg, 'mod', mod) order by dia), '[]'::jsonb) into v_pesos
    from ag.pesos where usuario = u.id and ((sec > desde and not (dia = any (hechos_p))) or dia = any (rech_p));
  select jsonb_build_object('datos', datos, 'mod', mod) into v_estado
    from ag.estado where usuario = u.id and ((sec > desde and not est_hecho) or est_rech);
  select coalesce(max(sec), 0) into v_cursor from (
    select sec from ag.dias where usuario = u.id union all
    select sec from ag.pesos where usuario = u.id union all
    select sec from ag.estado where usuario = u.id) todo;

  return jsonb_build_object(
    'sesion', true,
    'usuario', jsonb_build_object('id', u.id, 'nombre', u.nombre, 'admin', u.admin),
    'cursor', v_cursor, 'dias', v_dias, 'pesos', v_pesos, 'estado', v_estado,
    'rechazadas', jsonb_build_object('dias', to_jsonb(rech_d), 'pesos', to_jsonb(rech_p), 'estado', est_rech));
end $$;

/* ── El administrador ───────────────────────────────────────────────────────────────────────────── */

-- Quién llama, solo si es administrador.
create or replace function ag.admin(p_token text) returns ag.usuarios
language plpgsql volatile set search_path = '' as $$
declare u ag.usuarios := ag.sesion(p_token); nadie ag.usuarios;
begin
  if u.id is null or not u.admin then return nadie; end if;
  return u;
end $$;

-- Quién usa la app y su actividad. Nunca lo que comen ni lo que pesan.
create or replace function public.ag_admin_usuarios(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios := ag.admin(p_token); hoy date := (now() at time zone 'Europe/Madrid')::date; lista jsonb;
begin
  if u.id is null then return jsonb_build_object('ok', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'nombre', x.nombre, 'admin', x.admin, 'activo', x.activo, 'yo', x.id = u.id,
      'pendiente', x.pin_hash is null,
      'caduca_dias', case when x.pin_hash is null and x.caduca is not null then greatest(0, ceil(extract(epoch from x.caduca - now()) / 86400))::integer end,
      'creado', x.creado, 'visto', x.visto,
      'bloqueado', coalesce(x.bloqueado_hasta > now(), false),
      'dias7', (select count(*) from ag.dias d where d.usuario = x.id and d.dia between hoy - 6 and hoy and jsonb_array_length(d.comidas) > 0),
      'dias', (select count(*) from ag.dias d where d.usuario = x.id and jsonb_array_length(d.comidas) > 0))
    order by (x.id = u.id) desc, x.creado, x.nombre), '[]'::jsonb) into lista
  from ag.usuarios x;
  return jsonb_build_object('ok', true, 'usuarios', lista);
end $$;

-- Invitar: un nombre, y sale el código (la única vez que se ve).
create or replace function public.ag_admin_invitar(p_token text, p_nombre text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios := ag.admin(p_token); nombre text := btrim(coalesce(p_nombre, '')); c text;
begin
  if u.id is null then return jsonb_build_object('ok', false); end if;
  if char_length(nombre) < 1 or char_length(nombre) > 40 then return jsonb_build_object('ok', false, 'motivo', 'nombre'); end if;
  if (select count(*) from ag.usuarios) >= 300 then return jsonb_build_object('ok', false, 'motivo', 'tope'); end if;
  c := ag.alta(nombre, false);
  return jsonb_build_object('ok', true, 'codigo', c);
end $$;

-- Desactivar (fuera al momento, los datos se quedan) o volver a activar.
create or replace function public.ag_admin_activar(p_token text, p_usuario uuid, p_activo boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios := ag.admin(p_token); hecho uuid;
begin
  if u.id is null then return jsonb_build_object('ok', false); end if;
  if p_usuario = u.id then return jsonb_build_object('ok', false, 'motivo', 'tu'); end if;
  update ag.usuarios set activo = coalesce(p_activo, true) where id = p_usuario returning id into hecho;
  if hecho is null then return jsonb_build_object('ok', false, 'motivo', 'usuario'); end if;
  if not coalesce(p_activo, true) then delete from ag.sesiones where usuario = p_usuario; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Enlace nuevo para alguien: el código viejo deja de valer, sus móviles salen y tendrá que crear PIN otra vez.
create or replace function public.ag_admin_enlace(p_token text, p_usuario uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u ag.usuarios := ag.admin(p_token); c text; hecho uuid;
begin
  if u.id is null then return jsonb_build_object('ok', false); end if;
  if p_usuario = u.id then return jsonb_build_object('ok', false, 'motivo', 'tu'); end if;
  c := ag.codigo_libre();
  update ag.usuarios set codigo_hash = ag.huella(c), pin_hash = null, caduca = now() + interval '7 days', fallos = 0, bloqueado_hasta = null
   where id = p_usuario returning id into hecho;
  if hecho is null then return jsonb_build_object('ok', false, 'motivo', 'usuario'); end if;
  delete from ag.sesiones where usuario = p_usuario;
  return jsonb_build_object('ok', true, 'codigo', ag.bonito(c));
end $$;

/* ── Permisos ───────────────────────────────────────────────────────────────────────────────────── */

revoke all on schema ag from public, anon, authenticated;
revoke all on all tables in schema ag from public, anon, authenticated;
revoke all on all sequences in schema ag from public, anon, authenticated;
revoke all on all functions in schema ag from public, anon, authenticated;

revoke all on function public.ag_mirar(text), public.ag_crear_pin(text, text), public.ag_entrar(text, text), public.ag_salir(text),
  public.ag_sinc(text, bigint, jsonb), public.ag_admin_usuarios(text), public.ag_admin_invitar(text, text),
  public.ag_admin_activar(text, uuid, boolean), public.ag_admin_enlace(text, uuid) from public;
grant execute on function public.ag_mirar(text), public.ag_crear_pin(text, text), public.ag_entrar(text, text), public.ag_salir(text),
  public.ag_sinc(text, bigint, jsonb), public.ag_admin_usuarios(text), public.ag_admin_invitar(text, text),
  public.ag_admin_activar(text, uuid, boolean), public.ag_admin_enlace(text, uuid) to anon, authenticated;
