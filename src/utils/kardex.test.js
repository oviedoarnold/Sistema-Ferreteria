import { describe, it, expect } from "vitest"

import {
  etiquetaDeMovimiento,
  entradaYSalida,
  documentoDe,
  TIPOS_DE_MOVIMIENTO,
} from "./kardex"

const movimiento = (cambios = {}) => ({
  tipo: "entrada",
  cantidad: 10,
  venta_id: null,
  numero_factura: null,
  motivo: "",
  ...cambios,
})

describe("cómo se nombra cada movimiento", () => {
  it("una entrada es una entrada", () => {
    expect(etiquetaDeMovimiento(movimiento())).toBe("Entrada")
  })

  it("una salida con venta es una venta", () => {
    expect(
      etiquetaDeMovimiento(
        movimiento({ tipo: "salida", cantidad: -3, venta_id: "v1" })
      )
    ).toBe("Venta")
  })

  /*
    Sin factura detrás, la mercadería se fue por otro camino —una merma, un
    traslado—. Llamarla venta sería inventar un documento que no existe.
  */
  it("una salida sin venta es una salida", () => {
    expect(
      etiquetaDeMovimiento(movimiento({ tipo: "salida", cantidad: -3 }))
    ).toBe("Salida")
  })

  it("una devolución con venta es una anulación", () => {
    expect(
      etiquetaDeMovimiento(
        movimiento({ tipo: "devolucion", cantidad: 3, venta_id: "v1" })
      )
    ).toBe("Anulación")
  })

  it("una devolución sin venta es solo una devolución", () => {
    expect(
      etiquetaDeMovimiento(movimiento({ tipo: "devolucion", cantidad: 3 }))
    ).toBe("Devolución")
  })

  it("un ajuste es un ajuste en cualquier dirección", () => {
    expect(etiquetaDeMovimiento(movimiento({ tipo: "ajuste", cantidad: 5 })))
      .toBe("Ajuste")

    expect(etiquetaDeMovimiento(movimiento({ tipo: "ajuste", cantidad: -5 })))
      .toBe("Ajuste")
  })

  /*
    El motivo lo escribe una persona y cambia con el tiempo; la relación con
    la venta es un dato. Decidir por el texto haría que renombrar un motivo
    reclasificara movimientos históricos.
  */
  it("no se deja engañar por el texto del motivo", () => {
    expect(
      etiquetaDeMovimiento(
        movimiento({ tipo: "entrada", cantidad: 5, motivo: "Venta anulada" })
      )
    ).toBe("Entrada")

    expect(
      etiquetaDeMovimiento(
        movimiento({ tipo: "salida", cantidad: -5, motivo: "FAC-01210" })
      )
    ).toBe("Salida")
  })

  it("no revienta con un movimiento de tipo desconocido", () => {
    expect(etiquetaDeMovimiento(movimiento({ tipo: "loquesea" }))).toBe(
      "Movimiento"
    )

    expect(etiquetaDeMovimiento(undefined)).toBe("Movimiento")
  })
})

describe("en qué columna cae la cantidad", () => {
  it("lo positivo entra", () => {
    expect(entradaYSalida(movimiento({ cantidad: 20 }))).toEqual({
      entrada: 20,
      salida: null,
    })
  })

  it("lo negativo sale, y sin el signo", () => {
    expect(
      entradaYSalida(movimiento({ tipo: "salida", cantidad: -3 }))
    ).toEqual({ entrada: null, salida: 3 })
  })

  /*
    Lo decide el signo y no el tipo. Un ajuste corrige un conteo hacia
    arriba o hacia abajo, y guiarse por el tipo lo pondría siempre en la
    misma columna, con el número contradiciendo al encabezado.
  */
  it("un ajuste hacia arriba entra", () => {
    expect(
      entradaYSalida(movimiento({ tipo: "ajuste", cantidad: 7 }))
    ).toEqual({ entrada: 7, salida: null })
  })

  it("un ajuste hacia abajo sale", () => {
    expect(
      entradaYSalida(movimiento({ tipo: "ajuste", cantidad: -7 }))
    ).toEqual({ entrada: null, salida: 7 })
  })

  it("una devolución entra", () => {
    expect(
      entradaYSalida(movimiento({ tipo: "devolucion", cantidad: 3 }))
    ).toEqual({ entrada: 3, salida: null })
  })

  it("no pone nada cuando no hay cantidad", () => {
    expect(entradaYSalida(movimiento({ cantidad: 0 }))).toEqual({
      entrada: null,
      salida: null,
    })

    expect(entradaYSalida(undefined)).toEqual({ entrada: null, salida: null })
  })
})

describe("el documento que respalda el movimiento", () => {
  it("es el número de factura cuando lo hay", () => {
    expect(documentoDe(movimiento({ numero_factura: "FAC-01210" }))).toBe(
      "FAC-01210"
    )
  })

  it("no hay documento cuando el movimiento no viene de una venta", () => {
    expect(documentoDe(movimiento())).toBeNull()
    expect(documentoDe(undefined)).toBeNull()
  })
})

describe("los tipos que ofrece el filtro", () => {
  /*
    Los valores tienen que ser los de la base: son los que viajan en la
    consulta. La etiqueta es lo único que puede leerse distinto.
  */
  it("usa los valores reales del CHECK de la tabla", () => {
    expect(TIPOS_DE_MOVIMIENTO.map((t) => t.valor)).toEqual([
      "entrada",
      "salida",
      "ajuste",
      "devolucion",
    ])
  })

  it("los muestra con acento y en castellano", () => {
    expect(
      TIPOS_DE_MOVIMIENTO.find((t) => t.valor === "devolucion").etiqueta
    ).toBe("Devolución")
  })
})
