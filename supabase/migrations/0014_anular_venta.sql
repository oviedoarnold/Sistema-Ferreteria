-- Una factura emitida se anula; no desaparece.
--
-- PROBLEMA QUE RESUELVE
--
-- 0013 cerró el borrado físico, y con eso el ciclo de vida de una venta
-- quedó sin salida: una factura mal emitida no se podía deshacer de ninguna
-- forma. La mercadería seguía descontada y el documento seguía vigente.
--
-- La anulación es la salida correcta, y no por comodidad. El correlativo
-- pertenece a una numeración autorizada que el SAR exige continua: el
-- número ya se emitió y tiene que seguir teniendo un documento que lo
-- respalde, aunque ese documento diga que se anuló. Borrar dejaba el número
-- sin dueño; anular lo conserva y explica qué pasó con él.
--
-- LO QUE YA EXISTÍA
--
-- El esquema de 0001 lo anticipó y nunca se usó:
--
--   ventas.estado                 check (... 'anulada')
--   movimientos_inventario.tipo   check (... 'devolucion')
--
-- Por eso aquí no hay ningún ALTER sobre esos CHECK: el estado y el tipo de
-- movimiento ya estaban declarados. Quien busque esa modificación y no la
-- encuentre, es por esto.

-- ─────────────────────────────────────────────────────────
-- 1. EL RASTRO DE LA ANULACIÓN
--
-- Tres columnas, y ninguna de más:
--
--   anulada_at        cuándo
--   anulada_por       quién
--   motivo_anulacion  por qué  <- lo único que nadie puede reconstruir
--                                 después por otro medio
--
-- No se agrega una columna "anulada boolean": sería un segundo lugar donde
-- guardar lo que ya dice estado, y dos lugares con la misma verdad terminan
-- desincronizados. Impedir la doble anulación tampoco la necesita: lo hace
-- el propio estado bajo el candado de la fila.
-- ─────────────────────────────────────────────────────────

alter table ventas add column if not exists anulada_at  timestamptz;
alter table ventas add column if not exists anulada_por uuid
  references usuarios (id) on delete set null;
alter table ventas add column if not exists motivo_anulacion text;

/*
  Coherencia: una venta anulada no puede estar anulada a medias.

  Solo exige los tres datos cuando el estado es 'anulada', así que las
  facturas normales no cambian y las que ya existen siguen siendo válidas.

  El mínimo de cinco caracteres está aquí y no solo en la función porque un
  motivo en blanco vacía de sentido a la columna: sin él la auditoría
  guardaría filas que dicen "se anuló" sin decir por qué.
*/
alter table ventas drop constraint if exists anulada_exige_rastro;
alter table ventas add constraint anulada_exige_rastro
  check (
    estado <> 'anulada'
    or (
      anulada_at  is not null
      and anulada_por is not null
      and length(btrim(coalesce(motivo_anulacion, ''))) >= 5
    )
  );

-- Simétrico al idx_ventas_pendientes de 0001: las anuladas se consultan
-- como grupo y son pocas frente al total.
create index if not exists idx_ventas_anuladas on ventas (empresa_id, fecha desc)
  where estado = 'anulada';

-- ─────────────────────────────────────────────────────────
-- 2. anular_venta()
--
-- SECURITY INVOKER, por lo mismo que crear_venta_atomica: las políticas RLS
-- siguen aplicando a cada escritura y el aislamiento entre ferreterías no se
-- reimplementa aquí dentro. Una venta de otra empresa ni siquiera es
-- visible, así que la comprobación de pertenencia la sigue haciendo la base.
--
-- La empresa y el usuario no se reciben: se derivan de auth.uid().
--
-- CÓDIGOS DE ERROR
--
--   28000  la sesión no corresponde a un usuario activo
--   42501  quien llama no es administrador
--   P0001  el motivo no sirve
--   P0002  la factura no existe o es de otra ferretería
--   VA001  la factura ya estaba anulada
--   VA002  la factura tiene abonos
--
-- Los dos últimos son de una clase propia a propósito. El candidato obvio
-- era seguir la serie con P0004 y P0005, pero P0004 es ASSERT_FAILURE, y
-- PostgreSQL excluye ese código de "exception when others" deliberadamente:
-- una función que envolviera a esta no podría atrapar la doble anulación.
-- ─────────────────────────────────────────────────────────

create or replace function anular_venta(
  p_venta_id uuid,
  p_motivo   text
)
returns void
language plpgsql
as $$
declare
  v_usuario      uuid;
  v_empresa      uuid;
  v_es_admin     boolean;
  v_motivo       text;
  v_venta        record;
  v_producto_id  uuid;
  v_abonos       integer;
  v_pagado       numeric(12,2);
begin
  -- 1. Quién es y a qué ferretería pertenece.
  select id, empresa_id
    into v_usuario, v_empresa
    from usuarios
   where auth_id = auth.uid()
     and activo;

  if v_usuario is null then
    raise exception 'La sesión no corresponde a ningún usuario activo.'
      using errcode = '28000';
  end if;

  /*
    2. Solo un administrador anula.

    Los permisos del sistema son de pantalla —permissions.js reparte
    acceso a páginas— así que no hay un permiso "anular" que consultar. El
    rol es el control que corresponde, y ya existe.
  */
  v_es_admin := usuario_es_admin();

  if not v_es_admin then
    raise exception 'Solo un administrador puede anular una factura.'
      using errcode = '42501';
  end if;

  -- 3. El motivo es obligatorio y tiene que decir algo.
  v_motivo := btrim(coalesce(p_motivo, ''));

  if length(v_motivo) < 5 then
    raise exception 'Explica el motivo de la anulación (al menos 5 caracteres).'
      using errcode = 'P0001';
  end if;

  /*
    4. Candado sobre la venta, y la lectura del estado en la MISMA
       sentencia.

       Ese detalle es lo que hace correcta la comprobación del paso 6. Si
       se leyera el estado antes de bloquear, dos administradores anulando
       a la vez leerían los dos 'pagada', los dos pasarían la comprobación
       y el inventario terminaría con el doble de unidades devueltas.

       Bloqueando primero, el segundo espera; y cuando el primero confirma,
       relee la fila ya actualizada y encuentra 'anulada'.
  */
  select * into v_venta
    from ventas
   where id = p_venta_id
   for update;

  -- 5. Existe y es de esta ferretería. RLS ya oculta las ajenas, así que
  --    una venta de otra empresa llega hasta aquí como inexistente.
  if not found or v_venta.empresa_id <> v_empresa then
    raise exception 'La factura no existe o no pertenece a esta ferretería.'
      using errcode = 'P0002';
  end if;

  -- 6. Con el candado tomado, recién ahora se mira el estado.
  if v_venta.estado = 'anulada' then
    raise exception 'La factura % ya estaba anulada.', v_venta.numero_factura
      using errcode = 'VA001';
  end if;

  /*
    7. Una factura con abonos no se anula.

       Anular una factura ya cobrada no es un hecho de inventario sino de
       caja: el dinero entró. Deshacerlo en silencio desde aquí haría que el
       sistema afirmara que ese cobro nunca existió, y no hay módulo de caja
       ni nota de crédito donde registrar la devolución.

       Se prefiere que el sistema diga que no puede antes que mentir. El
       administrador decide por separado y de forma explícita qué hacer con
       el dinero, eliminando los abonos desde el historial.
  */
  select count(*), coalesce(sum(monto), 0)
    into v_abonos, v_pagado
    from abonos
   where venta_id = p_venta_id;

  if v_abonos > 0 then
    raise exception
      'Esta factura tiene % abono(s) registrado(s) por L %. Elimina los abonos desde el historial antes de anularla.',
      v_abonos, to_char(v_pagado, 'FM999999990.00')
      using errcode = 'VA002';
  end if;

  /*
    8. Candado sobre los productos, en orden ascendente de id.

       El orden importa y conviene dejarlo escrito: la jerarquía del sistema
       es ventas antes que productos, y productos siempre ascendente.
       crear_venta_atomica solo toma productos y nunca bloquea una venta ya
       existente, así que no hay ciclo posible entre las dos funciones.
       Invertir este orden en una función futura produciría interbloqueos
       intermitentes bajo carga, de los más difíciles de diagnosticar.
  */
  for v_producto_id in
    select distinct producto_id
      from detalle_venta
     where venta_id = p_venta_id
       and producto_id is not null
     order by 1
  loop
    perform 1 from productos where id = v_producto_id for update;
  end loop;

  /*
    9. Los movimientos compensatorios.

       El asiento original NO se toca. Se agrega uno positivo por cada
       renglón, con el mismo venta_id, para que el libro muestre las dos
       cosas juntas:

         Venta FAC-01211      -5
         Anulación FAC-01211  +5

       La suma de esa factura queda en cero, que es lo correcto: en neto no
       movió inventario. Lo que no debe parecer es que la venta nunca
       ocurrió.

       El motivo del asiento es técnico y lleva el número de factura. El
       motivo comercial que escribió el administrador vive en
       ventas.motivo_anulacion y no se repite en cada renglón.
  */
  insert into movimientos_inventario
    (empresa_id, producto_id, usuario_id, venta_id, tipo, cantidad, motivo)
  select v_empresa,
         d.producto_id,
         v_usuario,
         p_venta_id,
         'devolucion',
         abs(d.cantidad),
         'Anulación ' || v_venta.numero_factura
    from detalle_venta d
   where d.venta_id = p_venta_id
     and d.producto_id is not null;

  /*
    10. El estado y su rastro, en la misma sentencia.

        El correlativo y el numero_factura no se tocan: el número emitido
        sigue perteneciendo a este documento y nunca se reutiliza. Tampoco
        se toca empresas.proximo_correlativo_factura, porque anular no
        libera el número.
  */
  update ventas
     set estado           = 'anulada',
         anulada_at       = now(),
         anulada_por      = v_usuario,
         motivo_anulacion = v_motivo
   where id = p_venta_id;
end $$;

comment on function anular_venta(uuid, text) is
  'Anula una factura emitida: devuelve la mercadería con movimientos '
  'compensatorios, deja constancia de quién, cuándo y por qué, y conserva '
  'el documento y su correlativo. Rechaza las que tengan abonos.';

-- ─────────────────────────────────────────────────────────
-- 3. COMPROBACIÓN
-- ─────────────────────────────────────────────────────────

do $$
declare
  v_faltan  text;
  v_empresa text;
begin
  select string_agg(c, ', ')
    into v_faltan
    from unnest(array['anulada_at', 'anulada_por', 'motivo_anulacion']) as c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ventas'
        and column_name = c
   );

  if v_faltan is not null then
    raise exception 'faltan columnas del rastro de anulación: %', v_faltan;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'anulada_exige_rastro'
       and conrelid = 'ventas'::regclass
  ) then
    raise exception 'falta la restricción anulada_exige_rastro';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'anular_venta'
  ) then
    raise exception 'no se creó anular_venta()';
  end if;

  /*
    La restricción tiene que rechazar de verdad un estado incoherente. Se
    comprueba intentándolo: una restricción que existe pero no aplica es
    exactamente lo que esta comprobación busca detectar.
  */
  select id::text into v_empresa from empresas limit 1;

  if v_empresa is null then
    raise notice 'sin empresas: no se pudo probar anulada_exige_rastro contra una fila real';
  else
    begin
      insert into ventas (empresa_id, numero_factura, correlativo, forma_pago, estado)
      values (v_empresa::uuid, 'COMPROBACION-0014', -1, 'contado', 'anulada');

      raise exception 'anulada_exige_rastro aceptó una anulada sin quién ni por qué';
    exception
      when check_violation then null;
    end;
  end if;

  raise notice 'Una factura emitida ya puede anularse sin perder su historia.';
end $$;
