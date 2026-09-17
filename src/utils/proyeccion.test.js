import { describe, it, expect } from "vitest"

import {
  aclaracionDelEscenario,
  contarProductos,
  describirConteo,
  describirPeriodo,
  describirPeriodoEnPalabras,
  describirRiesgo,
  distribucionDeRiesgo,
  esProductoSimulado,
  filtrarPorRiesgo,
  formatearUnidades,
  inversionPorCategoria,
  mayorDemandaProyectada,
  ordenarPorPrioridad,
  porcentaje,
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

  it("nombra un solo mes cuando el período no pasa de un mes", () => {
    expect(describirPeriodo({ desde: "2026-09-01", hasta: "2026-09-30" })).toBe("septiembre 2026")
  })

  it("devuelve texto vacío si las fechas no son válidas", () => {
    expect(describirPeriodo({ desde: "x", hasta: "y" })).toBe("")
    expect(describirPeriodo()).toBe("")
  })

  it("se puede escribir dentro de una oración", () => {
    expect(describirPeriodoEnPalabras({ desde: "2026-01-01", hasta: "2026-08-31" })).toBe("enero a agosto de 2026")
    expect(describirPeriodoEnPalabras({ desde: "x", hasta: "2026-08-31" })).toBe("")
  })
})

describe("mayor demanda proyectada", () => {
  it("ordena por la demanda predicha a 30 días, de mayor a menor, y se queda con 10", () => {
    const top = mayorDemandaProyectada(PRODUCTOS_DE_PRUEBA)

    expect(top.map((p) => p.codigo)).toEqual([
      "CEM-001", "FER-020", "TOR-001", "FER-022", "FER-021",
      "FER-041", "CER-023", "FER-040", "FER-043", "FER-042",
    ])
  })

  it("desempata por código y no altera la lista original", () => {
    const empatados = [
      { codigo: "B", demanda_predicha_30d: 5 },
      { codigo: "A", demanda_predicha_30d: 5 },
    ]

    expect(mayorDemandaProyectada(empatados).map((p) => p.codigo)).toEqual(["A", "B"])
    expect(empatados[0].codigo).toBe("B")
  })

  it("acepta otro límite y una lista vacía", () => {
    expect(mayorDemandaProyectada(PRODUCTOS_DE_PRUEBA, 3)).toHaveLength(3)
    expect(mayorDemandaProyectada()).toEqual([])
  })
})

describe("inversión por categoría", () => {
  it("agrupa la inversión de los productos con compra, de mayor a menor", () => {
    expect(inversionPorCategoria(PRODUCTOS_DE_PRUEBA)).toEqual([
      { categoria: "Construcción", inversion: 39008, productos: 3 },
      { categoria: "Herramientas Eléctricas", inversion: 21000, productos: 2 },
      { categoria: "Tornillería", inversion: 6300, productos: 1 },
      { categoria: "Plomería", inversion: 3000, productos: 1 },
      { categoria: "Jardinería", inversion: 150, productos: 1 },
    ])
  })

  it("suma lo mismo que la inversión de todos los productos con compra", () => {
    const porCategorias = inversionPorCategoria(PRODUCTOS_DE_PRUEBA).reduce((s, c) => s + c.inversion, 0)
    const porProductos = PRODUCTOS_DE_PRUEBA.reduce((s, p) => s + p.inversion_estimada, 0)

    expect(porCategorias).toBe(porProductos)
  })

  it("deja fuera las categorías sin reposición", () => {
    const categorias = inversionPorCategoria(PRODUCTOS_DE_PRUEBA).map((c) => c.categoria)

    expect(categorias).not.toContain("Cerrajería")
  })

  it("redondea a centavos y desempata por nombre", () => {
    const productos = [
      { categoria: "B", recomendacion_compra: 1, inversion_estimada: 0.1 },
      { categoria: "B", recomendacion_compra: 1, inversion_estimada: 0.2 },
      { categoria: "A", recomendacion_compra: 1, inversion_estimada: 0.3 },
    ]

    expect(inversionPorCategoria(productos)).toEqual([
      { categoria: "A", inversion: 0.3, productos: 1 },
      { categoria: "B", inversion: 0.3, productos: 2 },
    ])
    expect(inversionPorCategoria()).toEqual([])
  })
})

describe("distribución de riesgo", () => {
  it("cuenta alto, medio y bajo con su porcentaje y el total como suma", () => {
    const { segmentos, total } = distribucionDeRiesgo({
      productos_riesgo_alto: 28,
      productos_riesgo_medio: 6,
      productos_riesgo_bajo: 16,
    })

    expect(total).toBe(50)
    expect(segmentos).toEqual([
      { riesgo: "alto", etiqueta: "Alto", cantidad: 28, porcentaje: 56 },
      { riesgo: "medio", etiqueta: "Medio", cantidad: 6, porcentaje: 12 },
      { riesgo: "bajo", etiqueta: "Bajo", cantidad: 16, porcentaje: 32 },
    ])
  })

  it("trata un conteo ausente como cero", () => {
    const { segmentos, total } = distribucionDeRiesgo({ productos_riesgo_alto: 2 })

    expect(total).toBe(2)
    expect(segmentos.map((s) => s.cantidad)).toEqual([2, 0, 0])
    expect(distribucionDeRiesgo().total).toBe(0)
  })
})

describe("conteo de productos", () => {
  it("usa singular y plural", () => {
    expect(contarProductos(1)).toBe("1 producto")
    expect(contarProductos(3)).toBe("3 productos")
  })
})

describe("porcentaje", () => {
  it("redondea a entero la parte sobre el total", () => {
    expect(porcentaje(28, 50)).toBe(56)
    expect(porcentaje(1, 3)).toBe(33)
  })

  it("devuelve 0 si no hay total", () => {
    expect(porcentaje(5, 0)).toBe(0)
    expect(porcentaje(5, undefined)).toBe(0)
  })
})

describe("aclaración del escenario", () => {
  it("cuenta los productos con los números del archivo", () => {
    expect(aclaracionDelEscenario({ productos: 12, productos_sistema: 3, productos_simulados: 9 })).toBe(
      "Escenario académico de 12 productos: 3 del sistema y 9 simulados para análisis. " +
        "Las ventas históricas utilizadas para el modelo son simuladas."
    )
  })
})

describe("conteo de la tabla", () => {
  it("llama prioritarios a los primeros de la vista general", () => {
    expect(describirConteo({ riesgo: "todos", mostrados: 10, total: 50 })).toBe("10 prioritarios de 50 productos")
  })

  it("es neutro con un filtro de riesgo", () => {
    expect(describirConteo({ riesgo: "bajo", mostrados: 10, total: 16 })).toBe("Mostrando 10 de 16 productos")
  })

  it("es neutro cuando ya se ven todos", () => {
    expect(describirConteo({ riesgo: "todos", mostrados: 50, total: 50 })).toBe("Mostrando 50 de 50 productos")
  })
})
