import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import InvoiceTemplate from "./InvoiceTemplate"

/*
  Una factura anulada se sigue pudiendo consultar e imprimir: el documento
  existió, su número no se reutiliza, y quien lo tenga en la mano tiene que
  poder verlo. Lo que no puede es callarse que está anulada.
*/

const empresa = {
  name: "Ferretería de prueba",
  address: "Barrio El Centro",
  phone: "2222-0000",
  currency: "L",
  taxRate: 15,
}

const factura = (extra = {}) => ({
  id: "F-1",
  invoiceNumber: "FAC-01211",
  date: "14/09/2026",
  clientName: "Ferremax",
  customerName: "Ferremax",
  items: [
    { productId: "p1", name: "Martillo", qty: 2, price: 100, subtotal: 200 },
  ],
  subtotal: 200,
  tax: 30,
  taxRate: 15,
  total: 230,
  paymentType: "contado",
  type: "contado",
  status: "pagada",
  payments: [],
  company: empresa,
  ...extra,
})

const anulada = (extra = {}) =>
  factura({
    status: "anulada",
    voidReason: "se facturó el producto equivocado",
    voidedAt: "2026-09-14T15:00:00.000Z",
    ...extra,
  })

describe("una factura anulada impresa", () => {
  it("lleva la banda ANULADA", async () => {
    const { container } = render(
      <InvoiceTemplate sale={anulada()} company={empresa} />
    )

    expect(container.querySelector(".inv-void")).toHaveTextContent("ANULADA")
  })

  /*
    Dos veces a propósito: la banda para quien mire el documento de reojo, y
    el campo Estado para quien lo lea con detenimiento.
  */
  it("también lo dice en el campo Estado", async () => {
    const { container } = render(
      <InvoiceTemplate sale={anulada()} company={empresa} />
    )

    const estado = [
      ...container.querySelectorAll(".inv-meta-row"),
    ].find((fila) => fila.textContent.startsWith("Estado"))

    expect(estado).toHaveTextContent("ANULADA")
  })

  /*
    El estado decía "Pendiente" para cualquier cosa que no fuera pagada, así
    que una anulada se imprimía como si el cliente aún debiera.
  */
  it("no se imprime como pendiente", async () => {
    render(<InvoiceTemplate sale={anulada()} company={empresa} />)

    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument()
    expect(screen.queryByText("PENDIENTE DE PAGO")).not.toBeInTheDocument()
  })

  it("muestra el motivo de la anulación", async () => {
    render(<InvoiceTemplate sale={anulada()} company={empresa} />)

    expect(
      screen.getByText("se facturó el producto equivocado")
    ).toBeInTheDocument()
  })

  it("conserva el número, los renglones y los importes", async () => {
    render(<InvoiceTemplate sale={anulada()} company={empresa} />)

    expect(screen.getAllByText(/FAC-01211/).length).toBeGreaterThan(0)
    expect(screen.getByText("Martillo")).toBeInTheDocument()
    expect(screen.getAllByText(/230\.00/).length).toBeGreaterThan(0)
  })
})

describe("las facturas normales no cambian", () => {
  it("una pagada no lleva ninguna banda", async () => {
    render(<InvoiceTemplate sale={factura()} company={empresa} />)

    expect(screen.queryByText("ANULADA")).not.toBeInTheDocument()
    expect(screen.queryByText("PENDIENTE DE PAGO")).not.toBeInTheDocument()
    expect(screen.getByText("Pagada")).toBeInTheDocument()
  })

  it("una pendiente sigue avisando que falta pagar", async () => {
    render(
      <InvoiceTemplate
        sale={factura({
          status: "pendiente",
          paymentType: "credito",
          type: "credito",
        })}
        company={empresa}
      />
    )

    expect(screen.getByText("PENDIENTE DE PAGO")).toBeInTheDocument()
    expect(screen.queryByText("ANULADA")).not.toBeInTheDocument()
  })
})
