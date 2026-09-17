/*
  Cómo se lee la proyección de demanda.

  Son decisiones sobre los datos y no sobre el diseño: qué producto va
  primero, qué riesgo es cuál, qué productos deja un filtro, cómo se escribe
  una cantidad. Viven fuera de los componentes para probarlas solas y dejar
  el JSX sin condicionales.

  Todas las cifras del bloque predictivo salen del detalle de productos. Así
  un filtro recalcula tarjetas, gráficas y tabla con la misma operación, y
  sin filtros el resultado es el resumen publicado.
*/

import { roundMoney } from "./salesUtils"

const LOCALE = "es-HN"

export const PRODUCTOS_PRIORITARIOS = 10

export const PRODUCTOS_EN_TOP_DEMANDA = 10

export const RIESGOS = {
  alto: { etiqueta: "Alto", clase: "badge-out", orden: 0 },
  medio: { etiqueta: "Medio", clase: "badge-low", orden: 1 },
  bajo: { etiqueta: "Bajo", clase: "badge-ok", orden: 2 },
}

export const TODAS_LAS_CATEGORIAS = "todas"

export const TODOS_LOS_RIESGOS = "todos"

export const FILTROS_INICIALES = { categoria: TODAS_LAS_CATEGORIAS, riesgo: TODOS_LOS_RIESGOS }

/*
  Qué atender primero: lo que corre más riesgo, y entre iguales, lo que más
  hay que comprar y lo que más se va a vender. El código desempata para que
  el orden no cambie entre una carga y otra.
*/
export function ordenarPorPrioridad(productos = []) {
  return [...productos].sort(
    (a, b) =>
      ordenDeRiesgo(a.riesgo) - ordenDeRiesgo(b.riesgo) ||
      b.recomendacion_compra - a.recomendacion_compra ||
      b.demanda_predicha_30d - a.demanda_predicha_30d ||
      String(a.codigo).localeCompare(String(b.codigo))
  )
}

function ordenDeRiesgo(riesgo) {
  return RIESGOS[riesgo]?.orden ?? Object.keys(RIESGOS).length
}

/* La intersección de los filtros: un producto queda si cumple todos. */
export function filtrarProductos(productos = [], { categoria, riesgo } = FILTROS_INICIALES) {
  return productos.filter(
    (producto) =>
      (categoria === TODAS_LAS_CATEGORIAS || producto.categoria === categoria) &&
      (riesgo === TODOS_LOS_RIESGOS || producto.riesgo === riesgo)
  )
}

export function hayFiltrosActivos({ categoria, riesgo }) {
  return categoria !== TODAS_LAS_CATEGORIAS || riesgo !== TODOS_LOS_RIESGOS
}

export function categoriasDe(productos = []) {
  return [...new Set(productos.map((producto) => producto.categoria))].sort((a, b) => a.localeCompare(b))
}

const sumar = (productos, campo) => productos.reduce((suma, producto) => suma + Number(producto[campo]), 0)

const contarRiesgo = (productos, riesgo) => productos.filter((producto) => producto.riesgo === riesgo).length

/*
  Las cifras de las tarjetas para un conjunto de productos. Redondea igual que
  el pipeline, así que sobre los 50 productos devuelve el resumen publicado.
*/
export function resumirProductos(productos = []) {
  return {
    productos: productos.length,
    demanda_total_7d: roundMoney(sumar(productos, "demanda_predicha_7d")),
    demanda_total_30d: roundMoney(sumar(productos, "demanda_predicha_30d")),
    productos_riesgo_alto: contarRiesgo(productos, "alto"),
    productos_riesgo_medio: contarRiesgo(productos, "medio"),
    productos_riesgo_bajo: contarRiesgo(productos, "bajo"),
    productos_con_compra: productos.filter((producto) => producto.recomendacion_compra > 0).length,
    unidades_recomendadas: sumar(productos, "recomendacion_compra"),
    inversion_estimada: roundMoney(sumar(productos, "inversion_estimada")),
  }
}

/*
  Demanda mensual de un conjunto de productos: cada mes histórico es la suma
  de lo que vendieron esos productos, y la proyección es la suma de su demanda
  predicha a 30 días.

  El riesgo es una clasificación del inventario actual, no del pasado. Filtrar
  por riesgo alto muestra el histórico de los productos que HOY están en
  riesgo alto; no afirma que estuvieran en riesgo en esos meses.
*/
export function serieDeDemanda(productos = [], plantilla = []) {
  return plantilla.map((mes) => ({
    ...mes,
    unidades:
      mes.tipo === "proyeccion"
        ? roundMoney(sumar(productos, "demanda_predicha_30d"))
        : productos.reduce((suma, producto) => suma + Number(producto.historico_mensual?.[mes.mes] ?? 0), 0),
  }))
}

/*
  Todo lo que el Dashboard muestra de la proyección para unos filtros.

  La dona y las barras de categoría funcionan como en un tablero de BI: cada
  una se calcula sin su propio filtro, para mostrar las demás opciones con la
  elegida resaltada. La dona respeta la categoría y las barras respetan el
  riesgo; tarjetas, histórico, top y tabla respetan ambos.
*/
export function analizarProyeccion({ productos = [], serie_mensual: plantilla = [] }, filtros = FILTROS_INICIALES) {
  const filtrados = filtrarProductos(productos, filtros)

  return {
    total: productos.length,
    categorias: categoriasDe(productos),
    filtrados,
    resumen: resumirProductos(filtrados),
    resumenSinFiltroDeRiesgo: resumirProductos(filtrarProductos(productos, { ...filtros, riesgo: TODOS_LOS_RIESGOS })),
    sinFiltroDeCategoria: filtrarProductos(productos, { ...filtros, categoria: TODAS_LAS_CATEGORIAS }),
    serie: serieDeDemanda(filtrados, plantilla),
  }
}

/* En qué punto está la proyección: cargando, con error, sin coincidencias o lista para mostrar. */
export function estadoDeProyeccion({ datos, error }, analisis) {
  if (error) return "error"
  if (!datos) return "cargando"
  return analisis.filtrados.length === 0 ? "vacio" : "listo"
}

/* Los que hay que comprar, en orden de prioridad. */
export function productosParaReponer(productos = [], limite = PRODUCTOS_PRIORITARIOS) {
  return ordenarPorPrioridad(productos)
    .filter((producto) => producto.recomendacion_compra > 0)
    .slice(0, limite)
}

export function describirCompra(producto) {
  return producto.recomendacion_compra > 0
    ? `Comprar ${formatearUnidades(producto.recomendacion_compra, 0)}`
    : "Sin compra"
}

/* Las líneas del detalle flotante de un producto. */
export function detalleDeProducto(producto) {
  return [
    `${producto.producto} · ${producto.codigo}`,
    `Demanda 7 días: ${formatearUnidades(producto.demanda_predicha_7d)} u.`,
    `Demanda 30 días: ${formatearUnidades(producto.demanda_predicha_30d)} u.`,
    `Stock: ${formatearUnidades(producto.stock_actual, 0)}`,
    `Riesgo: ${describirRiesgo(producto.riesgo).etiqueta}`,
    `Recomendación: ${describirCompra(producto)}`,
  ]
}

/*
  Los que más se espera vender a 30 días según el modelo. Es la demanda
  predicha, no la histórica: responde qué se va a mover, no qué se movió.
*/
export function mayorDemandaProyectada(productos = [], limite = PRODUCTOS_EN_TOP_DEMANDA) {
  return [...productos]
    .sort(
      (a, b) =>
        b.demanda_predicha_30d - a.demanda_predicha_30d || String(a.codigo).localeCompare(String(b.codigo))
    )
    .slice(0, limite)
}

/*
  Inversión recomendada agrupada por categoría, de mayor a menor. Solo cuentan
  los productos con reposición: el resto no suma inversión ni aparece como
  categoría vacía.
*/
export function inversionPorCategoria(productos = []) {
  const grupos = new Map()

  for (const producto of productos) {
    if (!(producto.recomendacion_compra > 0)) continue

    const grupo = grupos.get(producto.categoria) ?? { categoria: producto.categoria, inversion: 0, productos: 0 }

    grupo.inversion += Number(producto.inversion_estimada)
    grupo.productos += 1
    grupos.set(producto.categoria, grupo)
  }

  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, inversion: roundMoney(grupo.inversion) }))
    .sort((a, b) => b.inversion - a.inversion || a.categoria.localeCompare(b.categoria))
}

/*
  Cuántos productos hay en cada riesgo, en el orden alto, medio, bajo. El
  total es la suma de los tres: así la dona y su leyenda siempre cuadran.
*/
export function distribucionDeRiesgo(resumen = {}) {
  const segmentos = Object.entries(RIESGOS).map(([riesgo, { etiqueta }]) => ({
    riesgo,
    etiqueta,
    cantidad: Number(resumen[`productos_riesgo_${riesgo}`]) || 0,
  }))
  const total = segmentos.reduce((suma, segmento) => suma + segmento.cantidad, 0)

  return {
    total,
    segmentos: segmentos.map((segmento) => ({ ...segmento, porcentaje: porcentaje(segmento.cantidad, total) })),
  }
}

export function palabraProductos(cantidad) {
  return cantidad === 1 ? "producto" : "productos"
}

export function contarProductos(cantidad) {
  return `${cantidad} ${palabraProductos(cantidad)}`
}

export function describirRiesgo(riesgo) {
  return RIESGOS[riesgo] ?? { etiqueta: "Sin dato", clase: "badge-void" }
}

/*
  "50 productos" sin filtros; con filtros, qué se eligió y cuánto quedó:
  "Plomería · Riesgo alto · 4 de 50 productos".
*/
export function describirFiltros({ categoria, riesgo }, { mostrados, total }) {
  if (!hayFiltrosActivos({ categoria, riesgo })) return contarProductos(total)

  const elegidos = [
    categoria !== TODAS_LAS_CATEGORIAS && categoria,
    riesgo !== TODOS_LOS_RIESGOS && `Riesgo ${describirRiesgo(riesgo).etiqueta.toLowerCase()}`,
  ].filter(Boolean)

  return [...elegidos, `${mostrados} de ${contarProductos(total)}`].join(" · ")
}

export function formatearUnidades(valor, decimales = 1) {
  const numero = Number(valor)
  const seguro = Number.isFinite(numero) ? numero : 0

  return seguro.toLocaleString(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/*
  "enero–agosto 2026", o "septiembre 2026" si el período cabe en un mes.

  Las fechas del JSON vienen como texto ISO y se leen al mediodía: a
  medianoche, una zona horaria al oeste de Greenwich las movería al día
  anterior.
*/
export function describirPeriodo({ desde, hasta } = {}) {
  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return ""

  const mes = (fecha) => fecha.toLocaleDateString(LOCALE, { month: "long" })
  const anio = fin.getFullYear()

  return mes(inicio) === mes(fin) ? `${mes(fin)} ${anio}` : `${mes(inicio)}–${mes(fin)} ${anio}`
}

/* Porcentaje entero de una parte sobre el total; 0 si no hay total. */
export function porcentaje(parte, total) {
  if (!(total > 0)) return 0

  return Math.round((Number(parte) / total) * 100)
}

/*
  "prioritarios" solo describe la vista general sin filtros, que va en orden
  de prioridad. Con un filtro aplicado, el conteo es neutro.
*/
export function describirConteo({ hayFiltros, mostrados, total }) {
  if (!hayFiltros && mostrados < total) return `${mostrados} prioritarios de ${total} productos`

  return `Mostrando ${mostrados} de ${total} productos`
}
