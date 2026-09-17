import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { ClientesRecientes, UltimasVentas } from "./WidgetsDeOperacion"

describe("listas de la operación", () => {
  it("una venta sin cliente se muestra como Consumidor Final", () => {
    render(<UltimasVentas ultimasVentas={[{ id: "F-1", total: 50 }]} />)

    expect(screen.getByText("Consumidor Final")).toBeInTheDocument()
    expect(screen.getByText("L 50.00")).toBeInTheDocument()
  })

  it("usa el nombre de cliente de las ventas anteriores", () => {
    render(<UltimasVentas ultimasVentas={[{ id: "F-2", customer: "Ferremax", total: 10 }]} />)

    expect(screen.getByText("Ferremax")).toBeInTheDocument()
  })

  it("un cliente sin teléfono muestra un guion, y sin clientes lo dice", () => {
    const { unmount } = render(<ClientesRecientes clientes={[{ id: "c1", name: "Taller Rivera" }]} />)

    expect(screen.getByText("Taller Rivera").closest(".dash-mini-row")).toHaveTextContent("—")

    unmount()
    render(<ClientesRecientes clientes={[]} />)

    expect(screen.getByText("Sin clientes registrados")).toBeInTheDocument()
  })
})
