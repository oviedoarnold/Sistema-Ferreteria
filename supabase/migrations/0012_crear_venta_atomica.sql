-- Emitir una factura pasa a ser una sola operación atómica.
--
-- PROBLEMA QUE RESUELVE
--
-- Hasta ahora el frontend hacía cinco viajes de red sin transacción: pedía
-- el correlativo, insertaba la cabecera, insertaba el detalle, insertaba
-- los movimientos de inventario, y si algo fallaba intentaba borrar la
-- cabecera con un sexto viaje que también podía fallar.
--
-- Eso dejaba tres fallos posibles sin aviso: una factura con renglones
-- pero sin descargar el inventario —se vendió y el stock no bajó—, una
-- cabecera huérfana si el borrado compensatorio no llegaba, y un
-- correlativo quemado para siempre porque se pedía en su propia
-- transacción. El SAR exige que la numeración autorizada sea continua, y
-- cada fallo abría un hueco irreparable.
--
-- Y el stock se validaba en JavaScript contra el catálogo cargado en el
-- navegador, que puede llevar minutos desactualizado. Dos cajas vendiendo
-- la última unidad pasaban ambas la validación y el saldo quedaba en -1.
--
-- Ahora todo ocurre dentro de una transacción. Cualquier error revierte el
-- conjunto, incluido el incremento del correlativo.

-- ─────────────────────────────────────────────────────────
-- POR QUÉ SECURITY INVOKER
--
-- La función corre con los permisos de quien la llama, así que las
-- políticas RLS que ya existen se siguen aplicando a cada insert. El
-- aislamiento entre ferreterías no se reimplementa aquí dentro: lo sigue
-- garantizando la base, como en el resto del sistema.
--
-- Con SECURITY DEFINER pasaría lo contrario: saltaría RLS y habría que
-- repetir a mano cada comprobación de empresa, con el riesgo de olvidar
-- una. Se reserva para donde hace falta elevar de verdad, como
-- siguiente_correlativo(), que actualiza empresas —tabla que un vendedor
-- no puede tocar— y que esta función llama sin cambios.
--
-- La empresa y el usuario NO se reciben como parámetros: se derivan de
-- auth.uid(). Lo que no se recibe no se puede falsificar.
-- ─────────────────────────────────────────────────────────

create or replace function crear_venta_atomica(
  p_items               jsonb,
  p_forma_pago          text,
  p_tasa_isv            numeric,
  p_clave_idempotencia  text  default null,
  p_cliente_id          uuid  default null,
  p_nombre_cliente      text  default 'Consumidor Final',
  p_rtn_comprador       text  default '',
  p_fecha_vencimiento   date  default null,
  p_nota                text  default ''
)
returns uuid
language plpgsql
as $$
declare
  v_usuario      uuid;
  v_empresa      uuid;
  v_venta        uuid;
  v_correlativo  bigint;
  v_numero       text;
  v_subtotal     numeric(12,2);
  v_isv          numeric(12,2);
  v_total        numeric(12,2);
  v_estado       text;
  v_producto_id  uuid;
  v_fila         record;
  v_prod         record;
  v_emp          record;
  v_stock        integer;
begin
  -- 1. Quién es y a qué ferretería pertenece. Todo lo demás cuelga de aquí.
  select id, empresa_id
    into v_usuario, v_empresa
    from usuarios
   where auth_id = auth.uid()
     and activo;

  if v_usuario is null then
    raise exception 'La sesión no corresponde a ningún usuario activo.'
      using errcode = '28000';
  end if;

  -- 2. Idempotencia. Antes que nada: si esta venta ya se emitió, se
  --    devuelve la misma y no se consume otro correlativo.
  if p_clave_idempotencia is not null then
    select id into v_venta
      from ventas
     where empresa_id = v_empresa
       and clave_idempotencia = p_clave_idempotencia;

    if v_venta is not null then
      return v_venta;
    end if;
  end if;

  -- 3. Forma de la petición.
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener al menos un producto.'
      using errcode = 'P0001';
  end if;

  if p_forma_pago not in ('contado', 'credito') then
    raise exception 'Forma de pago no válida: %', p_forma_pago
      using errcode = 'P0001';
  end if;

  if p_forma_pago = 'credito' and p_cliente_id is null then
    raise exception 'Para una venta a crédito debes seleccionar un cliente registrado.'
      using errcode = 'P0001';
  end if;

  /*
    4. Candado sobre los productos, uno por uno y en orden ascendente de
       id. El orden es lo que evita el interbloqueo: dos ventas con los
       mismos productos en distinto orden de carrito los toman igual.

       Se bloquea productos y no movimientos_inventario porque el stock es
       un agregado y no una fila: no hay nada que bloquear en el libro. La
       fila del producto sirve de cerrojo para ese agregado.
  */
  for v_producto_id in
    select distinct (item->>'producto_id')::uuid
      from jsonb_array_elements(p_items) as item
     order by 1
  loop
    perform 1 from productos where id = v_producto_id for update;
  end loop;

  /*
    5. Con el candado tomado, recién ahora se mira el stock. Leerlo antes
       no serviría: dos transacciones concurrentes verían las dos el mismo
       estado previo y las dos se darían por buenas.

       Las cantidades se agrupan por producto: si el mismo artículo viene
       en dos renglones, lo que tiene que alcanzar es la suma.
  */
  for v_fila in
    select (item->>'producto_id')::uuid as producto_id,
           sum((item->>'cantidad')::integer) as cantidad
      from jsonb_array_elements(p_items) as item
     group by 1
  loop
    if v_fila.cantidad is null or v_fila.cantidad <= 0 then
      raise exception 'La cantidad de los productos debe ser mayor que cero.'
        using errcode = 'P0001';
    end if;

    select p.* into v_prod
      from productos p
     where p.id = v_fila.producto_id
       and p.empresa_id = v_empresa;

    if not found then
      raise exception 'Uno de los productos ya no existe en el inventario.'
        using errcode = 'P0002';
    end if;

    if not v_prod.activo then
      raise exception 'El producto % ya no está disponible.', v_prod.nombre
        using errcode = 'P0002';
    end if;

    select coalesce(sum(m.cantidad), 0) into v_stock
      from movimientos_inventario m
     where m.producto_id = v_fila.producto_id;

    if v_stock < v_fila.cantidad then
      raise exception 'Stock insuficiente de %. Solo hay % unidades disponibles.',
        v_prod.nombre, v_stock
        using errcode = 'P0003';
    end if;
  end loop;

  -- 6. El cliente, cuando se indica, tiene que ser de esta ferretería.
  if p_cliente_id is not null
     and not exists (
       select 1 from clientes
        where id = p_cliente_id and empresa_id = v_empresa
     ) then
    raise exception 'El cliente indicado no pertenece a esta ferretería.'
      using errcode = 'P0002';
  end if;

  /*
    7. Los importes se calculan aquí y no se reciben. El navegador manda
       qué se vendió y a qué precio; cuánto suma lo decide la base.
  */
  select coalesce(sum(
           (item->>'cantidad')::integer * (item->>'precio')::numeric
         ), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as item;

  v_isv   := round(v_subtotal * (coalesce(p_tasa_isv, 0) / 100), 2);
  v_total := v_subtotal + v_isv;

  /*
    8. El correlativo, al final. Pedirlo antes de validar es lo que hasta
       ahora quemaba números de la numeración autorizada cada vez que una
       venta fallaba. Dentro de la transacción, un error posterior revierte
       también este incremento.
  */
  v_correlativo := siguiente_correlativo('factura');

  select * into v_emp from empresas where id = v_empresa;

  -- Mismo criterio que el frontend: con CAI, rango y fecha límite
  -- cargados, numeración autorizada; sin ellos, numeración interna, que no
  -- pretende ser un documento fiscal.
  if coalesce(trim(v_emp.cai), '') <> ''
     and coalesce(v_emp.rango_hasta, 0) > 0
     and v_emp.fecha_limite_emision is not null then
    v_numero := concat_ws('-',
      lpad(coalesce(nullif(trim(v_emp.establecimiento), ''), '000'), 3, '0'),
      lpad(coalesce(nullif(trim(v_emp.punto_emision),   ''), '001'), 3, '0'),
      lpad(coalesce(nullif(trim(v_emp.tipo_documento),  ''), '01'),  2, '0'),
      lpad(v_correlativo::text, 8, '0')
    );
  else
    v_numero := 'FAC-' || lpad(v_correlativo::text, 5, '0');
  end if;

  v_estado := case when p_forma_pago = 'credito' then 'pendiente' else 'pagada' end;

  -- 9. Cabecera. Los datos fiscales se copian, no se referencian: renovar
  --    el CAI no puede alterar una factura ya emitida.
  insert into ventas (
    empresa_id, cliente_id, usuario_id,
    numero_factura, correlativo,
    nombre_cliente, rtn_comprador,
    subtotal, isv, tasa_isv, total,
    forma_pago, fecha_vencimiento, estado,
    cai_emision, rango_desde_emision, rango_hasta_emision,
    fecha_limite_emision_emision,
    nota, clave_idempotencia
  )
  values (
    v_empresa, p_cliente_id, v_usuario,
    v_numero, v_correlativo,
    coalesce(nullif(trim(p_nombre_cliente), ''), 'Consumidor Final'),
    coalesce(p_rtn_comprador, ''),
    v_subtotal, v_isv, coalesce(p_tasa_isv, 0), v_total,
    p_forma_pago,
    case when p_forma_pago = 'credito' then p_fecha_vencimiento else null end,
    v_estado,
    coalesce(v_emp.cai, ''), v_emp.rango_desde, v_emp.rango_hasta,
    v_emp.fecha_limite_emision,
    coalesce(p_nota, ''), p_clave_idempotencia
  )
  returning id into v_venta;

  -- 10. Renglones. El nombre y el código se copian por la misma razón que
  --     los datos fiscales: corregir el catálogo no reescribe lo vendido.
  insert into detalle_venta (
    empresa_id, venta_id, producto_id, nombre, codigo, cantidad, precio, subtotal
  )
  select
    v_empresa,
    v_venta,
    p.id,
    p.nombre,
    p.codigo,
    (item->>'cantidad')::integer,
    (item->>'precio')::numeric,
    round((item->>'cantidad')::integer * (item->>'precio')::numeric, 2)
  from jsonb_array_elements(p_items) as item
  join productos p on p.id = (item->>'producto_id')::uuid;

  -- 11. La salida de inventario, en el mismo compromiso que la factura.
  insert into movimientos_inventario (
    empresa_id, producto_id, usuario_id, venta_id, tipo, cantidad, motivo
  )
  select
    v_empresa,
    (item->>'producto_id')::uuid,
    v_usuario,
    v_venta,
    'salida',
    -abs((item->>'cantidad')::integer),
    'Venta'
  from jsonb_array_elements(p_items) as item;

  return v_venta;

/*
  Si dos intentos de la misma venta corren a la vez, el que pierde choca
  contra el índice único de la clave y devuelve la venta del que ganó, en
  vez de propagar un error que el cajero no sabría interpretar.
*/
exception
  when unique_violation then
    if p_clave_idempotencia is null then
      raise;
    end if;

    select id into v_venta
      from ventas
     where empresa_id = v_empresa
       and clave_idempotencia = p_clave_idempotencia;

    if v_venta is null then
      raise;
    end if;

    return v_venta;
end;
$$;

comment on function crear_venta_atomica is
  'Emite una factura completa en una sola transacción: valida, bloquea los productos, comprueba el stock contra el libro de movimientos, toma el correlativo y escribe cabecera, detalle y salidas de inventario. Cualquier error revierte todo, incluido el correlativo.';
