import { describe, it, expect } from "vitest"

import {
  describirPeriodo,
  describirRiesgo,
  esProductoSimulado,
  filtrarPorRiesgo,
  formatearUnidades,
  ordenarPorPrioridad,
} from "./proyeccion"
import { ORDEN_ESPERADO, PRODUCTOS_DE_PRUEBA } from "../test/proyeccionDePrueba"

describe("prioridad de las recomendaciones", () => {
  it("pone primero el riesgo alto, luego medio y al final bajo", () => {
    const riesgos = ordenarPorPrioridad(PRODUCTOS_DE_PRUEBA).map((p) => p.riesgo)

    expect(riesgos).toEqual([
      "alto", "alto", "alto", "alto", "alto", "alto", "medio", "medio", "bajo", "bajo", "bajo", "bajo",
    ])
  })

  /*
    Dentro del mismo riesgo manda cuánto hay que comprar; si empatan, cuánto
    se va a vender. Dos productos de riesgo alto con 10 unidades cada uno se
    ordenan por su demanda prevista.
  */
  it("desempata por recomendación y después por demanda", () => {
    expect(ordenarPorPrioridad(PRODUCTOS_DE_PRUEBA).map((p) => p.codigo)).toEqual(ORDEN_ESPERADO)
  })

  it("desempata por código cuando todo lo demás es igual", () => {
    const iguales = [
      { codigo: "B", riesgo: "bajo", recomendacion_compra: 0, demanda_predicha_30d: 1 },
      { codigo: "A", riesgo: "bajo", recomendacion_compra: 0, demanda_predicha_30d: 1 },
    ]

    expect(ordenarPorPrioridad(iguales).map((p) => p.codigo)).toEqual(["A", "B"])
  })

  it("manda al final un riesgo que no reconoce", () => {
    const productos = [
      { codigo: "X", riesgo: "desconocido", recomendacion_compra: 999, demanda_predicha_30d: 999 },
      { codigo: "Y", riesgo: "bajo", recomendacion_compra: 0, demanda_predicha_30d: 0 },
    ]

    expect(ordenarPorPrioridad(productos).map((p) => p.codigo)).toEqual(["Y", "X"])
  })

  it("no modifica la lista original", () => {
    const original = [...PRODUCTOS_DE_PRUEBA]

    ordenarPorPrioridad(PRODUCTOS_DE_PRUEBA)

    expect(PRODUCTOS_DE_PRUEBA).toEqual(original)
  })

  it("acepta que no haya productos", () => {
    expect(ordenarPorPrioridad()).toEqual([])
  })
})

describe("filtro por riesgo", () => {
  it("con 'todos' devuelve la lista completa", () => {
    expect(filtrarPorRiesgo(PRODUCTOS_DE_PRUEBA, "todos")).toHaveLength(12)
  })

  it("deja solo el riesgo pedido", () => {
    expect(filtrarPorRiesgo(PRODUCTOS_DE_PRUEBA, "medio").map((p) => p.codigo)).toEqual([
      "FER-030", "FER-031",
    ])
  })

  it("usa 'todos' si no se indica riesgo", () => {
    expect(filtrarPorRiesgo(PRODUCTOS_DE_PRUEBA)).toHaveLength(12)
    expect(filtrarPorRiesgo()).toEqual([])
  })
})

describe("cómo se muestra el riesgo", () => {
  it("cada nivel tiene texto y la clase visual del sistema", () => {
    expect(describirRiesgo("alto")).toMatchObject({ etiqueta: "Alto", clase: "badge-out" })
    expect(describirRiesgo("medio")).toMatchObject({ etiqueta: "Medio", clase: "badge-low" })
    expect(describirRiesgo("bajo")).toMatchObject({ etiqueta: "Bajo", clase: "badge-ok" })
  })

  it("un riesgo desconocido se muestra como tal y no como bajo", () => {
    expect(describirRiesgo("otro")).toEqual({ etiqueta: "Sin dato", clase: "badge-void" })
  })
})

describe("origen del producto", () => {
  it("solo los productos del sistema no son simulados", () => {
    expect(esProductoSimulado({ origen: "sistema" })).toBe(false)
    expect(esProductoSimulado({ origen: "sintetico" })).toBe(true)
  })
})

describe("formato de cantidades", () => {
  it("escribe miles con separador y un decimal por omisión", () => {
    expect(formatearUnidades(2470.87)).toBe("2,470.9")
  })

  it("admite otra cantidad de decimales", () => {
    expect(formatearUnidades(1286, 0)).toBe("1,286")
    expect(formatearUnidades(570.09, 2)).toBe("570.09")
  })

  it("no muestra NaN ante un valor que no es número", () => {
    expect(formatearUnidades("abc")).toBe("0.0")
    expect(formatearUnidades(undefined, 0)).toBe("0")
  })
})

describe("descripción del período", () => {
  it("nombra los meses de inicio y fin", () => {
    expect(describirPeriodo({ desde: "2026-01-01", hasta: "2026-08-31" })).toBe("enero–agosto 2026")
  })

  it("devuelve texto vacío si las fechas no son válidas", () => {
    expect(describirPeriodo({ desde: "x", hasta: "y" })).toBe("")
    expect(describirPeriodo()).toBe("")
  })
})
