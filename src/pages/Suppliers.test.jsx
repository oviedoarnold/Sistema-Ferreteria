import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import Suppliers from "./Suppliers"

const PROVEEDORES = [
  {
    id: "s1",
    name: "Distribuidora Ferretera",
    contact: "Carlos Mejía",
    phone: "2550-1234",
    email: "ventas@dist.hn",
    notes: "Cemento y varilla",
  },
  {
    id: "s2",
    name: "Pinturas del Norte",
    contact: "Ana López",
    phone: "2558-7788",
    email: "",
    notes: "",
  },
]

function renderSuppliers(proveedores = PROVEEDORES) {
  localStorage.setItem("suppliers", JSON.stringify(proveedores))
  return render(<Suppliers />)
}

const buscar = (texto) =>
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
    target: { value: texto },
  })

describe("Suppliers", () => {
  it("lista los proveedores guardados", () => {
    renderSuppliers()

    expect(screen.getByText("Distribuidora Ferretera")).toBeInTheDocument()
    expect(screen.getByText("Pinturas del Norte")).toBeInTheDocument()
  })

  it("filtra por nombre del proveedor", () => {
    renderSuppliers()
    buscar("pinturas")

    expect(screen.getByText("Pinturas del Norte")).toBeInTheDocument()
    expect(
      screen.queryByText("Distribuidora Ferretera")
    ).not.toBeInTheDocument()
  })

  it("filtra por nombre del contacto", () => {
    renderSuppliers()
    buscar("carlos")

    expect(screen.getByText("Distribuidora Ferretera")).toBeInTheDocument()
    expect(screen.queryByText("Pinturas del Norte")).not.toBeInTheDocument()
  })

  it("no muestra nada cuando la búsqueda no coincide", () => {
    renderSuppliers()
    buscar("proveedor-inexistente")

    expect(
      screen.queryByText("Distribuidora Ferretera")
    ).not.toBeInTheDocument()
  })

  it("abre el formulario de proveedor nuevo", () => {
    renderSuppliers()

    fireEvent.click(screen.getByRole("button", { name: /nuevo proveedor/i }))

    expect(
      screen.getByRole("heading", { name: /nuevo proveedor/i })
    ).toBeInTheDocument()
  })

  it("muestra un mensaje cuando no hay proveedores", () => {
    renderSuppliers([])

    expect(screen.getByText(/no hay proveedores/i)).toBeInTheDocument()
  })
})
