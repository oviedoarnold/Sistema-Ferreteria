/*
  Cómo se lee la proyección de demanda.

  Son decisiones sobre los datos y no sobre el diseño: qué producto va
  primero, qué riesgo es cuál, cómo se escribe una cantidad. Viven fuera de
  los componentes para probarlas solas y dejar el JSX sin condicionales.
*/

const LOCALE = "es-HN"

export const PRODUCTOS_PRIORITARIOS = 10

export const RIESGOS = {
  alto: { etiqueta: "Alto", clase: "badge-out", orden: 0 },
  medio: { etiqueta: "Medio", clase: "badge-low", orden: 1 },
  bajo: { etiqueta: "Bajo", clase: "badge-ok", orden: 2 },
}

export const FILTROS_DE_RIESGO = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "alto", etiqueta: "Alto" },
  { valor: "medio", etiqueta: "Medio" },
  { valor: "bajo", etiqueta: "Bajo" },
]

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

export function filtrarPorRiesgo(productos = [], riesgo = "todos") {
  if (riesgo === "todos") return productos

  return productos.filter((producto) => producto.riesgo === riesgo)
}

export function describirRiesgo(riesgo) {
  return RIESGOS[riesgo] ?? { etiqueta: "Sin dato", clase: "badge-void" }
}

export function esProductoSimulado(producto) {
  return producto?.origen !== "sistema"
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
*/
export function describirPeriodo(periodo) {
  const meses = mesesDelPeriodo(periodo)

  if (!meses) return ""

  const { inicio, fin, anio } = meses

  return inicio === fin ? `${fin} ${anio}` : `${inicio}–${fin} ${anio}`
}

/* "enero a agosto de 2026", para usar dentro de una oración. */
export function describirPeriodoEnPalabras(periodo) {
  const meses = mesesDelPeriodo(periodo)

  return meses ? `${meses.inicio} a ${meses.fin} de ${meses.anio}` : ""
}

/*
  Las fechas del JSON vienen como texto ISO y se leen al mediodía: a
  medianoche, una zona horaria al oeste de Greenwich las movería al día
  anterior.
*/
function mesesDelPeriodo({ desde, hasta } = {}) {
  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null

  const mes = (fecha) => fecha.toLocaleDateString(LOCALE, { month: "long" })

  return { inicio: mes(inicio), fin: mes(fin), anio: fin.getFullYear() }
}

/* Porcentaje entero de una parte sobre el total; 0 si no hay total. */
export function porcentaje(parte, total) {
  if (!(total > 0)) return 0

  return Math.round((Number(parte) / total) * 100)
}

export function aclaracionDelEscenario({ productos, productos_sistema: sistema, productos_simulados: simulados }) {
  return (
    `Escenario académico de ${productos} productos: ${sistema} del sistema y ${simulados} simulados para análisis. ` +
    "Las ventas históricas utilizadas para el modelo son simuladas."
  )
}

/*
  "prioritarios" solo describe la vista general, que va en orden de
  prioridad. Con un filtro de riesgo aplicado, el conteo es neutro.
*/
export function describirConteo({ riesgo, mostrados, total }) {
  if (riesgo === "todos" && mostrados < total) return `${mostrados} prioritarios de ${total} productos`

  return `Mostrando ${mostrados} de ${total} productos`
}
