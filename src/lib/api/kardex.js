import { supabase } from "../supabase"

/*
  Consulta al libro de movimientos de inventario.

  El saldo lo calcula la vista kardex, no esta función: recalcularlo aquí
  obligaría a traerse el historial completo para mostrar una página de
  veinticinco filas.

  Los filtros también viajan a la base. Filtrar en el navegador sobre una
  página ya recortada daría resultados que dependen de en qué página estaba
  el usuario cuando escribió.
*/

export const FILAS_POR_PAGINA = 25

const COLUMNAS = `
  id, fecha, producto_id, producto, codigo, tipo, cantidad,
  motivo, venta_id, numero_factura, usuario, saldo
`

function fallo(error, queHacia) {
  console.error(`No se pudo ${queHacia}:`, error)

  throw new Error(`No se pudo ${queHacia}.`)
}

/*
  "Hasta el 30 de septiembre" tiene que incluir ese día entero.

  La fecha del movimiento lleva hora, así que comparar contra la fecha pelada
  dejaría fuera todo lo registrado después de la medianoche: el último día
  del rango se perdería casi completo. Se compara contra el inicio del día
  siguiente.
*/
function finDelDia(fecha) {
  const limite = new Date(`${fecha}T00:00:00`)

  limite.setDate(limite.getDate() + 1)

  return limite.toISOString()
}

function conFiltros(consulta, filtros = {}) {
  const { productoId, busqueda, tipo, desde, hasta } = filtros

  if (productoId) consulta = consulta.eq("producto_id", productoId)
  if (tipo) consulta = consulta.eq("tipo", tipo)
  if (desde) consulta = consulta.gte("fecha", new Date(`${desde}T00:00:00`).toISOString())
  if (hasta) consulta = consulta.lt("fecha", finDelDia(hasta))

  const texto = String(busqueda || "").trim()

  if (texto) {
    consulta = consulta.or(`producto.ilike.%${texto}%,codigo.ilike.%${texto}%`)
  }

  return consulta
}

/*
  Devuelve una página del libro y cuántos movimientos hay en total, para que
  la pantalla sepa si existe una página siguiente sin tener que pedirla.

  El orden de presentación es el inverso del que usa la vista para acumular
  el saldo: en pantalla manda lo más reciente, y el saldo se acumula desde
  el principio. Son dos órdenes distintos sobre los mismos datos y no hay
  que confundirlos.
*/
export async function traerKardex({ filtros = {}, pagina = 1 } = {}) {
  const numeroDePagina = Math.max(1, Number(pagina) || 1)
  const desde = (numeroDePagina - 1) * FILAS_POR_PAGINA

  const consulta = conFiltros(
    supabase.from("kardex").select(COLUMNAS, { count: "exact" }),
    filtros
  )

  const { data, error, count } = await consulta
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, desde + FILAS_POR_PAGINA - 1)

  if (error) fallo(error, "cargar el kardex")

  return { filas: data || [], total: count || 0 }
}
