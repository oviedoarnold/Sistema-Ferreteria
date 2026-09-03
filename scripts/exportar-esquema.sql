-- Exporta el esquema real a JSON, para docs/db-export.json
--
-- Se corre en el SQL Editor de Supabase y devuelve una sola celda. Ese
-- texto es el contenido del archivo.
--
-- El export se genera consultando el catálogo de PostgreSQL y no las
-- migraciones: lo que interesa documentar es la base que está corriendo,
-- no la que creemos haber escrito. Si alguna vez difieren, el que manda es
-- este resultado.
--
-- El conteo de filas es exacto, no la estimación de pg_class: se ejecuta un
-- count(*) por tabla con query_to_xml, porque reltuples solo se actualiza
-- después de un vacuum y puede estar muy desfasado.

with tablas as (
  select c.oid, c.relname as nombre
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),

conteos as (
  select
    t.nombre,
    (xpath(
      '/row/cnt/text()',
      query_to_xml(
        format('select count(*) as cnt from public.%I', t.nombre),
        false, true, ''
      )
    ))[1]::text::bigint as filas
  from tablas t
),

columnas as (
  select
    t.nombre as tabla,
    jsonb_agg(
      jsonb_build_object(
        'nombre', a.attname,
        'tipo', format_type(a.atttypid, a.atttypmod),
        'obligatoria', a.attnotnull
      )
      order by a.attnum
    ) as lista
  from tablas t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  group by t.nombre
),

llaves_primarias as (
  select
    t.nombre as tabla,
    jsonb_agg(a.attname order by a.attname) as columnas
  from tablas t
  join pg_constraint k on k.conrelid = t.oid and k.contype = 'p'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any (k.conkey)
  group by t.nombre
),

foraneas as (
  select
    origen.relname as tabla,
    a.attname as columna,
    destino.relname as referencia,
    ad.attname as columna_referida,
    case k.confdeltype
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'a' then 'no action'
      else k.confdeltype::text
    end as al_borrar
  from pg_constraint k
  join pg_class origen on origen.oid = k.conrelid
  join pg_class destino on destino.oid = k.confrelid
  join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
  join pg_attribute ad on ad.attrelid = k.confrelid and ad.attnum = k.confkey[1]
  where k.contype = 'f'
    and origen.relnamespace = 'public'::regnamespace
),

indices as (
  select tablename as tabla, indexname as nombre, indexdef as definicion
  from pg_indexes
  where schemaname = 'public'
),

politicas as (
  select tablename as tabla, policyname as nombre, cmd as operacion
  from pg_policies
  where schemaname = 'public'
),

rls as (
  select t.nombre, c.relrowsecurity as activada
  from tablas t
  join pg_class c on c.oid = t.oid
),

vistas as (
  select
    c.relname as nombre,
    -- PostgreSQL guarda el valor tal como se escribio en el CREATE VIEW:
    -- "security_invoker=on". Comparar solo contra 'true' reportaba que la
    -- vista no lo tenia, cuando si lo tiene.
    coalesce(
      (select lower(option_value) in ('on', 'true', 'yes', '1')
       from pg_options_to_table(c.reloptions)
       where option_name = 'security_invoker'),
      false
    ) as security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
)

select jsonb_pretty(jsonb_build_object(
  'generado_en', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'motor', current_setting('server_version'),
  'esquema', 'public',

  'resumen', jsonb_build_object(
    'tablas', (select count(*) from tablas),
    'relaciones', (select count(*) from foraneas),
    'indices', (select count(*) from indices),
    'politicas_de_acceso', (select count(*) from politicas),
    'tablas_con_datos', (select count(*) from conteos where filas > 0),
    'tabla_con_mas_filas', (
      select nombre from conteos order by filas desc, nombre limit 1
    ),
    'filas_totales', (select coalesce(sum(filas), 0) from conteos)
  ),

  'tablas', (
    select jsonb_agg(
      jsonb_build_object(
        'nombre', t.nombre,
        'filas', co.filas,
        'llave_primaria', pk.columnas,
        'rls_activada', r.activada,
        'columnas', cl.lista,
        'indices', coalesce((
          select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'definicion', i.definicion) order by i.nombre)
          from indices i where i.tabla = t.nombre
        ), '[]'::jsonb),
        'politicas', coalesce((
          select jsonb_agg(jsonb_build_object('nombre', p.nombre, 'operacion', p.operacion) order by p.nombre)
          from politicas p where p.tabla = t.nombre
        ), '[]'::jsonb)
      )
      order by t.nombre
    )
    from tablas t
    join conteos co on co.nombre = t.nombre
    join columnas cl on cl.tabla = t.nombre
    join rls r on r.nombre = t.nombre
    left join llaves_primarias pk on pk.tabla = t.nombre
  ),

  'relaciones', (
    select jsonb_agg(
      jsonb_build_object(
        'desde', f.tabla,
        'columna', f.columna,
        'hacia', f.referencia,
        'columna_referida', f.columna_referida,
        'al_borrar', f.al_borrar
      )
      order by f.tabla, f.columna
    )
    from foraneas f
  ),

  'vistas', (
    select jsonb_agg(
      jsonb_build_object('nombre', v.nombre, 'security_invoker', v.security_invoker)
      order by v.nombre
    )
    from vistas v
  )
)) as db_export;
