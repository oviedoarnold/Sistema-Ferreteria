-- Una factura emitida deja de poder borrarse.
--
-- PROBLEMA QUE RESUELVE
--
-- 0012 cerró el hueco de la numeración por el lado de la emisión: ningún
-- intento fallido vuelve a quemar un correlativo. Pero quedaba abierto por
-- el otro extremo. Hoy cualquier usuario con sesión puede borrar cualquier
-- factura de su ferretería con una sola llamada HTTP:
--
--   GRANT DELETE a authenticated sobre ventas
--   política ventas_de_mi_empresa FOR ALL  ->  FOR ALL incluye DELETE
--   condición: empresa_id = empresa_del_usuario()  ->  sin exigir admin
--
-- No hace falta ningún botón: basta con llamar a la API. Y el daño no es
-- solo perder la factura:
--
--   detalle_venta   ON DELETE CASCADE   -> los renglones se borran
--   abonos          ON DELETE CASCADE   -> los recibos de dinero se borran
--   movimientos     ON DELETE SET NULL  -> el descuento de inventario
--                                          sobrevive sin factura que lo
--                                          explique
--
-- El más grave es el segundo. Borrar una factura destruye los abonos que el
-- cliente ya pagó, sin dejar rastro: si después reclama, no hay nada que
-- mostrarle.
--
-- El tercero rompe el Kardex. El movimiento no se borra, se queda huérfano,
-- así que el stock sigue cuadrando pero ya nadie puede responder a quién se
-- le vendió esa mercadería.
--
-- Y el correlativo queda sin dueño: el número se emitió, el contador avanzó,
-- y el documento ya no existe. Es exactamente el hueco en la numeración
-- autorizada que 0012 se dedicó a cerrar.
--
-- A partir de aquí una venta emitida solo puede anularse, nunca borrarse.
-- La anulación la agrega 0014; esta migración cierra primero la puerta,
-- porque mientras el borrado siga disponible la anulación sería una opción
-- más amable y no un reemplazo.
--
-- NOTA: no se reescribe 0001. Las migraciones históricas se conservan; esta
-- declara el estado final.

-- ─────────────────────────────────────────────────────────
-- 1. QUITAR EL PERMISO
--
-- Es la capa que da un error visible: PostgREST responde 403. Sin ella, y
-- solo con RLS, un DELETE afecta cero filas y no falla, que es peor: quien
-- lo intenta cree que funcionó.
--
-- Ninguna de estas tres tablas se borra desde la aplicación. El único
-- delete del módulo de ventas es el de abonos, que se conserva.
-- ─────────────────────────────────────────────────────────

revoke delete on ventas               from authenticated;
revoke delete on detalle_venta        from authenticated;
revoke delete on movimientos_inventario from authenticated;

/*
  abonos MANTIENE el permiso de borrado, a propósito.

  La interfaz permite corregir un abono mal registrado, y el flujo aprobado
  para anular una factura a crédito con abonos depende de eso: la anulación
  se rechaza mientras existan abonos, y el administrador debe eliminarlos
  explícitamente antes. Quitar este permiso dejaría esas facturas sin salida.
*/

-- ─────────────────────────────────────────────────────────
-- 2. POLÍTICAS EXPLÍCITAS
--
-- El bucle de 0001 declara "<tabla>_de_mi_empresa FOR ALL", y FOR ALL
-- incluye DELETE. Se reemplaza por una política por operación: lo que no
-- está escrito, no se concede.
--
-- El aislamiento por empresa no cambia en ninguna de las tres.
-- ─────────────────────────────────────────────────────────

drop policy if exists ventas_de_mi_empresa on ventas;

create policy ventas_select on ventas
  for select to authenticated
  using (empresa_id = empresa_del_usuario());

create policy ventas_insert on ventas
  for insert to authenticated
  with check (empresa_id = empresa_del_usuario());

-- El update se conserva: lo necesitan el estado por saldo de los abonos y
-- la anulación de 0014. Lo que no existe es una política de delete.
create policy ventas_update on ventas
  for update to authenticated
  using (empresa_id = empresa_del_usuario())
  with check (empresa_id = empresa_del_usuario());

drop policy if exists detalle_venta_de_mi_empresa on detalle_venta;

create policy detalle_venta_select on detalle_venta
  for select to authenticated
  using (empresa_id = empresa_del_usuario());

create policy detalle_venta_insert on detalle_venta
  for insert to authenticated
  with check (empresa_id = empresa_del_usuario());

/*
  El detalle no lleva update. Un renglón de una factura emitida no se
  corrige: se anula la factura y se emite otra. Que el importe impreso y el
  guardado puedan separarse es justo lo que una factura no debe permitir.
*/

drop policy if exists movimientos_inventario_de_mi_empresa on movimientos_inventario;

create policy movimientos_inventario_select on movimientos_inventario
  for select to authenticated
  using (empresa_id = empresa_del_usuario());

create policy movimientos_inventario_insert on movimientos_inventario
  for insert to authenticated
  with check (empresa_id = empresa_del_usuario());

/*
  El libro de movimientos es de solo agregar: ni update ni delete. Un
  asiento equivocado se corrige con otro asiento que lo compense, que es
  como se corrige un libro contable y la razón de que el inventario se
  guarde así y no como un número mutable.
*/

-- ─────────────────────────────────────────────────────────
-- 3. LLAVES FORÁNEAS QUE NO DESTRUYEN
--
-- Última capa, y la que protege aunque alguien vuelva a conceder el
-- permiso o a declarar una política amplia.
--
-- RESTRICT, nunca CASCADE: con CASCADE el borrado tiene éxito y arrastra
-- historia; con RESTRICT falla y avisa. SET NULL tampoco sirve aquí, porque
-- deja el dato vivo pero sin poder explicarlo.
-- ─────────────────────────────────────────────────────────

alter table movimientos_inventario
  drop constraint if exists movimientos_inventario_venta_id_fkey;
alter table movimientos_inventario
  add  constraint movimientos_inventario_venta_id_fkey
       foreign key (venta_id) references ventas (id) on delete restrict;

alter table detalle_venta
  drop constraint if exists detalle_venta_venta_id_fkey;
alter table detalle_venta
  add  constraint detalle_venta_venta_id_fkey
       foreign key (venta_id) references ventas (id) on delete restrict;

alter table abonos
  drop constraint if exists abonos_venta_id_fkey;
alter table abonos
  add  constraint abonos_venta_id_fkey
       foreign key (venta_id) references ventas (id) on delete restrict;

/*
  cotizaciones.venta_id se queda en SET NULL. Una cotización que pierde el
  enlace a su venta pierde una referencia, no un documento: la cotización
  sigue completa y la venta es la que no debe desaparecer. No es el mismo
  caso que los tres de arriba.
*/

-- ─────────────────────────────────────────────────────────
-- 4. EL KARDEX FRENTE AL BORRADO DE PRODUCTOS
--
-- El mismo agujero por otra puerta:
--
--   movimientos_inventario.producto_id ON DELETE CASCADE
--
-- Borrar un producto borraba su historial de movimientos completo. Peor que
-- el caso de las ventas, porque ahí el asiento sobrevivía huérfano y aquí
-- desaparece: el stock de los demás productos no cambia, pero las entradas,
-- salidas y ajustes de ese dejan de haber ocurrido.
-- ─────────────────────────────────────────────────────────

alter table movimientos_inventario
  drop constraint if exists movimientos_inventario_producto_id_fkey;
alter table movimientos_inventario
  add  constraint movimientos_inventario_producto_id_fkey
       foreign key (producto_id) references productos (id) on delete restrict;

/*
  Los permisos de productos se revisaron y se dejan como están.

  La aplicación nunca borra un producto: lo da de baja con activo = false
  (eliminarProducto en catalogos.js), y esa baja lógica sigue funcionando
  igual porque es un update.

  Con la llave de arriba, un producto que tenga movimientos ya no se puede
  borrar, que es lo que protege el Kardex. Uno que no los tenga sí, y está
  bien: no hay historial que destruir. Revocar el DELETE de productos no
  agregaría protección y alcanzaría casos legítimos, como descartar un
  producto recién creado por equivocación.
*/

-- ─────────────────────────────────────────────────────────
-- 5. COMPROBACIÓN
--
-- Una migración de seguridad aplicada a medias y en silencio es peor que
-- una que falla: deja creer que la protección está puesta.
-- ─────────────────────────────────────────────────────────

do $$
declare
  c_llaves_protegidas constant text[] := array[
    'movimientos_inventario_venta_id_fkey',
    'movimientos_inventario_producto_id_fkey',
    'detalle_venta_venta_id_fkey',
    'abonos_venta_id_fkey'
  ];
  v_en_restrict  text[];
  v_desprotegida text;
begin
  -- Las cuatro llaves foráneas, en RESTRICT ('r').
  select array_agg(conname order by conname)
    into v_en_restrict
    from pg_constraint
   where conname = any (c_llaves_protegidas)
     and confdeltype = 'r';

  if v_en_restrict is distinct from (select array_agg(x order by x)
                                       from unnest(c_llaves_protegidas) as x)
  then
    raise exception 'llaves foráneas en RESTRICT: % — se esperaban las cuatro: %',
      coalesce(v_en_restrict::text, 'ninguna'), c_llaves_protegidas;
  end if;

  -- Nadie autenticado puede borrar ventas, renglones ni movimientos.
  if has_table_privilege('authenticated', 'ventas', 'DELETE')
     or has_table_privilege('authenticated', 'detalle_venta', 'DELETE')
     or has_table_privilege('authenticated', 'movimientos_inventario', 'DELETE')
  then
    raise exception 'authenticated conserva permiso de DELETE sobre ventas, detalle o movimientos';
  end if;

  -- Los abonos sí se pueden corregir: el flujo de anulación lo necesita.
  if not has_table_privilege('authenticated', 'abonos', 'DELETE') then
    raise exception 'abonos perdió el permiso de DELETE que la anulación necesita';
  end if;

  -- Ninguna política puede volver a habilitar el borrado.
  select string_agg(tablename || '.' || policyname, ', ')
    into v_desprotegida
    from pg_policies
   where schemaname = 'public'
     and tablename in ('ventas', 'detalle_venta', 'movimientos_inventario')
     and cmd in ('ALL', 'DELETE');

  if v_desprotegida is not null then
    raise exception 'quedan políticas que permiten borrar: %', v_desprotegida;
  end if;

  raise notice 'Una factura emitida ya no se borra: solo podrá anularse.';
end $$;
