import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { RUTA_PROYECCION } from "./proyeccion"

/*
  Revisa el archivo que de verdad se publica, no un doble.

  Lo genera data-science/src/export_dashboard.py, que ya lo valida antes de
  escribirlo. Esta prueba repite las comprobaciones esenciales dentro de la
  integración continua, que no ejecuta Python: si alguien edita el JSON a
  mano, o lo regenera con un pipeline roto, el CI lo detiene aquí.
*/

/*
  Relativo a este archivo y no al directorio de trabajo, para que la prueba
  encuentre el JSON desde donde se ejecute.

  No se usa new URL(ruta, import.meta.url): Vite reescribe ese patrón para
  tratarlo como un recurso, y con una variable dentro lo convierte en
  "undefined".
*/
const archivo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", RUTA_PROYECCION)

const publicado = JSON.parse(readFileSync(archivo, "utf8"))

const { metadata, resumen, serie_mensual: serie, productos } = publicado

const suma = (campo) =>
  Math.round(productos.reduce((total, p) => total + p[campo], 0) * 100) / 100

describe("el archivo de proyección publicado", () => {
  it("tiene 50 productos: 9 del sistema y 41 simulados", () => {
    expect(productos).toHaveLength(50)
    expect(productos.filter((p) => p.origen === "sistema")).toHaveLength(9)
    expect(productos.filter((p) => p.origen === "sintetico")).toHaveLength(41)
    expect(metadata).toMatchObject({ productos: 50, productos_sistema: 9, productos_simulados: 41 })
  })

  it("no repite productos", () => {
    const ids = productos.map((p) => p.producto_id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it("no tiene cantidades negativas", () => {
    for (const p of productos) {
      expect(p.demanda_predicha_7d).toBeGreaterThanOrEqual(0)
      expect(p.demanda_predicha_30d).toBeGreaterThanOrEqual(0)
      expect(p.stock_actual).toBeGreaterThanOrEqual(0)
      expect(p.recomendacion_compra).toBeGreaterThanOrEqual(0)
      expect(p.inversion_estimada).toBeGreaterThanOrEqual(0)
    }
  })

  it("solo usa stock real en los productos del sistema", () => {
    for (const p of productos) {
      expect(p.tipo_stock).toBe(p.origen === "sistema" ? "real" : "simulado")
    }
  })

  it("cada riesgo es alto, medio o bajo, y el bajo es el único sin compra", () => {
    for (const p of productos) {
      expect(["alto", "medio", "bajo"]).toContain(p.riesgo)
      expect(p.riesgo === "bajo").toBe(p.recomendacion_compra === 0)
    }
  })

  /*
    El resumen alimenta las tarjetas y el detalle alimenta la tabla. Si no
    coinciden, la pantalla se contradice a sí misma.
  */
  it("el resumen coincide con el detalle", () => {
    expect(resumen.demanda_total_7d).toBe(suma("demanda_predicha_7d"))
    expect(resumen.demanda_total_30d).toBe(suma("demanda_predicha_30d"))
    expect(resumen.inversion_estimada).toBe(suma("inversion_estimada"))
    expect(resumen.unidades_recomendadas).toBe(suma("recomendacion_compra"))
    expect(resumen.productos_con_compra).toBe(productos.filter((p) => p.recomendacion_compra > 0).length)

    for (const riesgo of ["alto", "medio", "bajo"]) {
      expect(resumen[`productos_riesgo_${riesgo}`]).toBe(productos.filter((p) => p.riesgo === riesgo).length)
    }
  })

  it("el histórico va de enero a agosto y septiembre es la única proyección", () => {
    const historicos = serie.filter((m) => m.tipo === "historico").map((m) => m.mes)
    const proyectados = serie.filter((m) => m.tipo === "proyeccion")

    expect(historicos).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ])
    expect(proyectados.map((m) => m.mes)).toEqual(["2026-09"])
    expect(proyectados[0].unidades).toBe(resumen.demanda_total_30d)
  })

  it("declara que es un escenario académico con ventas simuladas", () => {
    expect(metadata.modelo).toBe("Random Forest")
    expect(metadata.fecha_corte).toBe("2026-08-31")
    expect(metadata.periodo_historico).toEqual({ desde: "2026-01-01", hasta: "2026-08-31" })
    expect(metadata.aclaracion).toMatch(/simulad/i)
  })
})
