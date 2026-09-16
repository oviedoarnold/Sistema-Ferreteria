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
  Altura de una barra como porcentaje de la más alta. Nunca menos de 4%: una
  barra en cero o casi cero tiene que seguir viéndose, porque su ausencia se
  confundiría con un dato que falta.
*/
export function alturaDeBarra(valor, maximo) {
  if (!(maximo > 0)) return 4

  return Math.max(4, Math.min(100, (Number(valor) / maximo) * 100))
}

/*
  "enero–agosto 2026". Las fechas del JSON vienen como texto
  ISO y se leen al mediodía: a medianoche, una zona horaria al oeste de
  Greenwich las movería al día anterior.
*/
export function describirPeriodo({ desde, hasta } = {}) {
  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return ""

  const mes = (fecha) => fecha.toLocaleDateString(LOCALE, { month: "long" })

  return `${mes(inicio)}–${mes(fin)} ${fin.getFullYear()}`
}
