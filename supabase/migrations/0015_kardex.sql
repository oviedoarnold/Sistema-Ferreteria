-- El libro de movimientos se puede consultar desde la aplicación.
--
-- QUÉ RESUELVE
--
-- movimientos_inventario guarda cada entrada, salida, ajuste y devolución
-- desde 0001, y desde 0014 también las anulaciones. Pero nadie podía verlo:
-- la única forma de leerlo era por SQL, y en la aplicación solo se consumía
-- agregado en stock_actual.
--
-- Esto dejaba la trazabilidad correcta en la base y sin uso. Un descuadre en
-- el conteo físico se podía rastrear, pero solo abriendo la base a mano.
--
-- LO QUE FALTABA ERA EL SALDO
--
-- El resto de las columnas ya existían. Lo que no se podía resolver leyendo
-- una fila es el stock que quedó DESPUÉS de ese movimiento: depende de todos
-- los movimientos anteriores de ese producto.
--
-- Calcularlo en el navegador obligaría a traerse el historial completo para
-- mostrar veinticinco filas, y a rehacerlo entero en cada página. Aquí lo
-- resuelve una función de ventana.

-- ─────────────────────────────────────────────────────────
-- 1. EL NOMBRE DE QUIEN MOVIÓ EL INVENTARIO
--
-- La política usuarios_select deja ver solo al propio usuario, o a todos los
-- de la empresa si quien consulta es administrador. Con eso, un vendedor con
-- permiso de inventario veía la columna Usuario EN BLANCO en los movimientos
-- del administrador, que es la mitad del libro.
--
-- Una pantalla de trazabilidad sin los autores no sirve para lo único que
-- justifica su existencia.
--
-- Se resuelve con la función más angosta posible en vez de ampliar
-- usuarios_select: ampliar la política expondría correo y rol de todos los
-- compañeros, mucha más superficie por el mismo resultado.
--
-- Qué puede devolver: un nombre. Nada más.
-- De quién: solo de alguien de la empresa de quien pregunta.
-- Cómo sabe cuál es esa empresa: de auth.uid(), nunca por parámetro, porque
-- un parámetro de empresa convertiría esta función en una puerta para leer
-- los nombres de cualquier ferretería del sistema.
-- ─────────────────────────────────────────────────────────

create or replace function nombre_de_usuario(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.nombre
    from usuarios u
   where u.id = p_usuario
     and u.empresa_id = empresa_del_usuario()
$$;

comment on function nombre_de_usuario(uuid) is
  'Nombre de un usuario de la propia empresa, para mostrar autoría en el '
  'Kardex. Devuelve NULL para cualquier usuario de otra empresa. No expone '
  'correo, rol ni permisos.';

-- ─────────────────────────────────────────────────────────
-- 2. LA VISTA
--
-- security_invoker = on, igual que stock_actual y productos_con_stock desde
-- 0004: la vista aplica las políticas de quien consulta. Sin eso devolvería
-- los movimientos de todas las ferreterías, que es exactamente el fallo que
-- 0004 corrigió.
--
-- El aislamiento por empresa no se repite aquí dentro: lo sigue haciendo la
-- política movimientos_inventario_select.
-- ─────────────────────────────────────────────────────────

drop view if exists kardex;

create view kardex
with (security_invoker = on)
as
  select
    m.id,
    m.empresa_id,
    m.fecha,

    m.producto_id,
    p.nombre  as producto,
    p.codigo,

    m.tipo,
    m.cantidad,
    m.motivo,

    m.venta_id,
    v.numero_factura,

    m.usuario_id,
    nombre_de_usuario(m.usuario_id) as usuario,

    /*
      El saldo del producto inmediatamente después de este movimiento.

      Particionado por producto: es lo único que hace significativo un saldo
      en una pantalla donde se mezclan todos. Sin la partición, la columna
      sumaría martillos con cemento.

      Ordenado por (fecha, id) y no solo por fecha. El id es el desempate y
      no es cosmético: los movimientos sembrados comparten el mismo
      timestamp al milisegundo, y sin desempate el orden varía entre
      consultas y el saldo salta de una ejecución a otra.

      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW y no el rango por
      omisión: RANGE agruparía en un solo escalón todas las filas con la
      misma fecha, y las que comparten timestamp mostrarían todas el saldo
      final del grupo en vez de su saldo real.
    */
    sum(m.cantidad) over (
      partition by m.producto_id
      order by m.fecha, m.id
      rows between unbounded preceding and current row
    ) as saldo

  from movimientos_inventario m
  join productos p on p.id = m.producto_id
  left join ventas v on v.id = m.venta_id;

comment on view kardex is
  'Libro de movimientos de inventario con el saldo acumulado por producto. '
  'El saldo se calcula dentro de la vista, así que filtrar o paginar por '
  'fuera no lo altera.';

/*
  Por qué esto se puede paginar sin romper el saldo:

  PostgreSQL no empuja condiciones por debajo de una función de ventana. El
  LIMIT y el WHERE que agrega PostgREST se aplican DESPUÉS de calcular la
  suma, así que pedir la página 3 filtrada por tipo sigue mostrando el saldo
  real de cada fila y no el de las filas que sobrevivieron al filtro.

  La excepción es el filtro por producto_id, que sí puede empujarse por ser
  la clave de partición. Ahí da igual: restringir a un producto no cambia el
  saldo de ese producto.
*/

-- ─────────────────────────────────────────────────────────
-- 3. COMPROBACIÓN
-- ─────────────────────────────────────────────────────────

do $$
declare
  c_esperadas constant text[] := array[
    'cantidad', 'codigo', 'empresa_id', 'fecha', 'id', 'motivo',
    'numero_factura', 'producto', 'producto_id', 'saldo', 'tipo',
    'usuario', 'usuario_id', 'venta_id'
  ];
  v_columnas text[];
  v_saldo    integer;
  v_suma     integer;
begin
  if not exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'kardex'
  ) then
    raise exception 'no se creó la vista kardex';
  end if;

  -- security_invoker es lo que mantiene el aislamiento entre ferreterías.
  if not exists (
    select 1 from pg_class
     where relname = 'kardex'
       and relnamespace = 'public'::regnamespace
       and reloptions @> array['security_invoker=on']
  ) then
    raise exception 'la vista kardex no quedó con security_invoker = on';
  end if;

  select array_agg(column_name order by column_name)
    into v_columnas
    from information_schema.columns
   where table_schema = 'public' and table_name = 'kardex';

  if v_columnas is distinct from c_esperadas then
    raise exception 'kardex quedó con columnas inesperadas: %', v_columnas;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'nombre_de_usuario'
  ) then
    raise exception 'no se creó nombre_de_usuario()';
  end if;

  /*
    El saldo de la última fila de un producto tiene que coincidir con la suma
    de todos sus movimientos. Si no coincide, la ventana está mal ordenada o
    mal particionada, y es el tipo de error que en pantalla se ve plausible.
  */
  select k.saldo, (select sum(m.cantidad)
                     from movimientos_inventario m
                    where m.producto_id = k.producto_id)
    into v_saldo, v_suma
    from kardex k
   order by k.producto_id, k.fecha desc, k.id desc
   limit 1;

  if v_saldo is not null and v_saldo is distinct from v_suma then
    raise exception 'el saldo final (%) no coincide con la suma del producto (%)',
      v_saldo, v_suma;
  end if;

  raise notice 'El libro de inventario ya se puede consultar desde la aplicación.';
end $$;
