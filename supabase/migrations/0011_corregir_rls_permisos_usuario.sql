-- Corrige la política de permisos_usuario que la cadena de migraciones
-- dejaba activa en una instalación nueva.
--
-- CONTEXTO
--
-- El bucle de 0001 crea "<tabla>_de_mi_empresa" para diez tablas. Para
-- nueve es correcto: todo lo de mi empresa es mío. Para permisos_usuario
-- no, porque ahí el sujeto es el usuario y no la empresa: esa política
-- concede FOR ALL sobre los permisos de todos los compañeros.
--
-- 0003 agregó las dos políticas correctas y en su versión original también
-- borraba la amplia. Esa línea se perdió al hacer idempotentes las
-- migraciones, así que hoy el repositorio ya no reproduce el estado de
-- seguridad de la base que describe.
--
-- Las políticas permisivas de PostgreSQL se combinan con OR: basta que una
-- autorice para que la operación pase. Añadir dos restrictivas junto a una
-- amplia no restringe nada. Un vendedor podría insertarse 'settings' y,
-- como la aplicación decide el acceso leyendo esta tabla, volverse
-- administrador.
--
-- No se reescribe 0003. Esta migración declara el estado final completo.

-- 1. La política amplia. En la base ya desplegada no existe y esto no hace
--    nada; en una instalación nueva es lo que cierra el agujero.
drop policy if exists permisos_usuario_de_mi_empresa on permisos_usuario;

/*
  2. Las dos correctas se redeclaran en vez de solo borrar la amplia.

  Si esta migración únicamente borrara, aplicarla sobre una base donde 0003
  nunca corrió dejaría la tabla con RLS activo y cero políticas, que en
  PostgreSQL significa denegar todo: nadie podría leer ni sus propios
  permisos y la aplicación dejaría de dar acceso a nadie.
*/
drop policy if exists permisos_propios_select on permisos_usuario;
create policy permisos_propios_select on permisos_usuario
  for select
  to authenticated
  using (
    usuario_id in (
      select id from usuarios where auth_id = auth.uid()
    )
    or (empresa_id = empresa_del_usuario() and usuario_es_admin())
  );

-- Solo un administrador reparte permisos. Sin política de insert, update o
-- delete para los demás, un vendedor no puede tocar ninguna fila.
drop policy if exists permisos_admin_escribe on permisos_usuario;
create policy permisos_admin_escribe on permisos_usuario
  for all
  to authenticated
  using (empresa_id = empresa_del_usuario() and usuario_es_admin())
  with check (empresa_id = empresa_del_usuario() and usuario_es_admin());

/*
  3. Comprobación. Una migración de seguridad que se aplica a medias y en
     silencio es peor que una que falla: si queda cualquier otra política
     sobre esta tabla, se detiene aquí en vez de dar por buena una tabla
     que sigue abierta.
*/
do $$
declare
  v_politicas text[];
begin
  select array_agg(policyname order by policyname)
    into v_politicas
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'permisos_usuario';

  if v_politicas is distinct from
     array['permisos_admin_escribe', 'permisos_propios_select']
  then
    raise exception
      'permisos_usuario quedó con políticas inesperadas: %', v_politicas;
  end if;

  raise notice 'permisos_usuario: cada quien ve los suyos, solo el administrador escribe.';
end $$;
