import { describe, it, expect } from "vitest"

import { resumirOperacion } from "./operacion"

const hoy = Date.now()

describe("resumen de la operación", () => {
  it("sin datos deja todo en cero", () => {
    expect(resumirOperacion()).toMatchObject({
      ventasHoy: 0,
      ventasDelMes: 0,
      stockBajo: 0,
      agotados: 0,
      porCobrar: 0,
      productos: 0,
      clientes: [],
      masVendidos: [],
      ultimasVentas: [],
    })
  })

  /*
    Las ventas guardadas antes de unificar los nombres de campos traen
    products, productName o quantity. Siguen contando igual.
  */
  it("cuenta los vendidos con los nombres de campos de ventas anteriores", () => {
    const { masVendidos } = resumirOperacion({
      ventas: [
        { id: "a", timestamp: hoy, total: 10, products: [{ productName: "Brocha", quantity: 3 }] },
        { id: "b", timestamp: hoy, total: 10, items: [{ name: "Brocha" }, {}] },
      ],
    })

    expect(masVendidos).toEqual([["Brocha", 4], ["Producto", 1]])
  })

  it("una venta sin detalle ni total no suma ni rompe el cálculo", () => {
    const resumen = resumirOperacion({ ventas: [{ id: "c", timestamp: hoy }] })

    expect(resumen.ventasHoy).toBe(0)
    expect(resumen.masVendidos).toEqual([])
  })

  it("sin mínimo configurado, considera bajo un stock de 5 o menos", () => {
    const { stockBajo, agotados } = resumirOperacion({
      productos: [{ stock: 5 }, { stock: 6 }, { stock: 0 }],
    })

    expect(stockBajo).toBe(1)
    expect(agotados).toBe(1)
  })

  it("ordena las últimas ventas de la más reciente a la más antigua, y las sin fecha al final", () => {
    const { ultimasVentas } = resumirOperacion({
      ventas: [
        { id: "vieja", timestamp: 1 },
        { id: "sin-fecha" },
        { id: "nueva", timestamp: 3 },
      ],
    })

    expect(ultimasVentas.map((venta) => venta.id)).toEqual(["nueva", "vieja", "sin-fecha"])
  })
})
