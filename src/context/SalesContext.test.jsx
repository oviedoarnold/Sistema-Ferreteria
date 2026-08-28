import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useContext } from "react"

import ProductProvider from "./ProductContext"
import SalesProvider, { SalesContext } from "./SalesContext"

const PRODUCTOS = [
  { id: "p1", code: "M-001", name: "Martillo", category: "Herramientas", price: 100, stock: 10, minStock: 2 },
  { id: "p2", code: "C-001", name: "Cemento", category: "Construcción", price: 200, stock: 3, minStock: 1 },
]

const EMPRESA = {
  name: "Ferretería Isaac",
  address: "San Pedro Sula",
  phone: "9709-0121",
  currency: "L",
  taxRate: 15,
}

function Wrapper({ children }) {
  return (
    <ProductProvider>
      <SalesProvider>{children}</SalesProvider>
    </ProductProvider>
  )
}

const renderSales = () =>
  renderHook(() => useContext(SalesContext), { wrapper: Wrapper })

const ventaContado = (overrides = {}) => ({
  items: [{ productId: "p1", qty: 2 }],
  paymentType: "contado",
  customerName: "Consumidor Final",
  ...overrides,
})

const ventaCredito = (overrides = {}) => ({
  items: [{ productId: "p1", qty: 1 }],
  paymentType: "credito",
  clientId: "c1",
  customerName: "Ferremax",
  dueDate: "2027-01-31",
  ...overrides,
})

beforeEach(() => {
  localStorage.setItem("products", JSON.stringify(PRODUCTOS))
  localStorage.setItem("company", JSON.stringify(EMPRESA))
})

describe("addSale: validaciones", () => {
  it("rechaza una venta sin datos", () => {
    const { result } = renderSales()

    expect(() => {
      act(() => result.current.addSale(null))
    }).toThrow()
  })

  it("rechaza una venta sin productos", () => {
    const { result } = renderSales()

    expect(() => {
      act(() => result.current.addSale({ items: [] }))
    }).toThrow(/al menos un producto/i)
  })

  it("rechaza una cantidad de cero o menos", () => {
    const { result } = renderSales()

    expect(() => {
      act(() =>
        result.current.addSale(ventaContado({ items: [{ productId: "p1", qty: 0 }] }))
      )
    }).toThrow(/mayor que cero/i)
  })

  it("rechaza un producto que no existe", () => {
    const { result } = renderSales()

    expect(() => {
      act(() =>
        result.current.addSale(ventaContado({ items: [{ productId: "zzz", qty: 1 }] }))
      )
    }).toThrow(/ya no existe/i)
  })

  it("rechaza vender más de lo que hay en stock", () => {
    const { result } = renderSales()

    expect(() => {
      act(() =>
        result.current.addSale(ventaContado({ items: [{ productId: "p2", qty: 99 }] }))
      )
    }).toThrow(/insuficiente/i)
  })

  it("exige un cliente registrado para vender al crédito", () => {
    const { result } = renderSales()

    expect(() => {
      act(() => result.current.addSale(ventaCredito({ clientId: null })))
    }).toThrow(/crédito/i)
  })
})

describe("addSale: factura generada", () => {
  it("registra la venta en el historial", () => {
    const { result } = renderSales()

    act(() => {
      result.current.addSale(ventaContado())
    })

    expect(result.current.sales).toHaveLength(1)
  })

  it("calcula subtotal, impuesto y total", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.subtotal).toBe(200)
    expect(factura.tax).toBe(30)
    expect(factura.total).toBe(230)
  })

  it("marca pagada la venta de contado", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.status).toBe("pagada")
    expect(factura.dueDate).toBeNull()
  })

  it("marca pendiente la venta al crédito y guarda el vencimiento", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaCredito())
    })

    expect(factura.status).toBe("pendiente")
    expect(factura.dueDate).toBe("2027-01-31")
  })

  it("usa numeración interna sin datos fiscales", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.invoiceNumber).toMatch(/^FAC-/)
    expect(factura.fiscal).toBeNull()
  })

  it("incrementa el correlativo entre facturas", () => {
    const { result } = renderSales()

    let primera
    let segunda

    act(() => {
      primera = result.current.addSale(ventaContado())
    })

    act(() => {
      segunda = result.current.addSale(ventaContado())
    })

    expect(primera.invoiceNumber).not.toBe(segunda.invoiceNumber)
  })

  it("congela los datos de la empresa dentro de la factura", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.company.name).toBe(EMPRESA.name)
    expect(factura.company.taxRate).toBe(15)
  })
})

describe("addSale con datos fiscales", () => {
  beforeEach(() => {
    localStorage.setItem(
      "company",
      JSON.stringify({
        ...EMPRESA,
        fiscal: {
          rtn: "08019012345678",
          cai: "A1B2C3-D4E5F6-A7B8C9-D1E2F3-A4B5C6-D7",
          establecimiento: "000",
          puntoEmision: "001",
          tipoDocumento: "01",
          rangoDesde: 1,
          rangoHasta: 9999,
          fechaLimiteEmision: "2027-12-31",
        },
      })
    )
  })

  it("usa la numeración autorizada", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.invoiceNumber).toMatch(/^000-001-01-\d{8}$/)
  })

  it("guarda una copia del CAI dentro de la factura", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(factura.fiscal.cai).toBe("A1B2C3-D4E5F6-A7B8C9-D1E2F3-A4B5C6-D7")
  })
})

describe("abonos", () => {
  const conVentaCredito = () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaCredito())
    })

    return { result, factura }
  }

  it("rechaza abonar a una factura inexistente", () => {
    const { result } = renderSales()

    expect(() => {
      act(() => result.current.addPayment("no-existe", { amount: 10 }))
    }).toThrow(/no existe/i)
  })

  it("rechaza abonar a una venta de contado", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(() => {
      act(() => result.current.addPayment(factura.id, { amount: 10 }))
    }).toThrow(/crédito/i)
  })

  it("rechaza un monto de cero", () => {
    const { result, factura } = conVentaCredito()

    expect(() => {
      act(() => result.current.addPayment(factura.id, { amount: 0 }))
    }).toThrow(/mayor que cero/i)
  })

  it("rechaza un abono mayor al saldo", () => {
    const { result, factura } = conVentaCredito()

    expect(() => {
      act(() =>
        result.current.addPayment(factura.id, { amount: factura.total + 1 })
      )
    }).toThrow(/no puede superar/i)
  })

  it("registra un abono parcial y deja la factura pendiente", () => {
    const { result, factura } = conVentaCredito()

    act(() => {
      result.current.addPayment(factura.id, { amount: 50, note: "Efectivo" })
    })

    const actualizada = result.current.getSaleById(factura.id)

    expect(actualizada.payments).toHaveLength(1)
    expect(actualizada.status).toBe("pendiente")
  })

  it("cancela la factura al cubrir el saldo completo", () => {
    const { result, factura } = conVentaCredito()

    act(() => {
      result.current.addPayment(factura.id, { amount: factura.total })
    })

    expect(result.current.getSaleById(factura.id).status).toBe("pagada")
  })

  it("no admite otro abono sobre una factura ya cancelada", () => {
    const { result, factura } = conVentaCredito()

    act(() => {
      result.current.addPayment(factura.id, { amount: factura.total })
    })

    expect(() => {
      act(() => result.current.addPayment(factura.id, { amount: 1 }))
    }).toThrow(/ya está cancelada/i)
  })

  it("al eliminar un abono la factura vuelve a pendiente", () => {
    const { result, factura } = conVentaCredito()

    let abono
    act(() => {
      abono = result.current.addPayment(factura.id, { amount: factura.total })
    })

    act(() => {
      result.current.deletePayment(factura.id, abono.id)
    })

    const actualizada = result.current.getSaleById(factura.id)

    expect(actualizada.status).toBe("pendiente")
    expect(actualizada.payments).toHaveLength(0)
  })
})

describe("búsqueda de facturas", () => {
  it("encuentra por número de factura", () => {
    const { result } = renderSales()

    let factura
    act(() => {
      factura = result.current.addSale(ventaContado())
    })

    expect(
      result.current.getSaleByInvoiceNumber(factura.invoiceNumber).id
    ).toBe(factura.id)
  })

  it("devuelve undefined si el número no existe", () => {
    const { result } = renderSales()
    expect(result.current.getSaleByInvoiceNumber("FAC-99999")).toBeUndefined()
  })
})
