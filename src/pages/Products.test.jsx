import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import { renderizarPantalla } from "../test/pantallas"
import Products from "./Products"

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const PRODUCTOS = [
  { id: "p1", code: "M-001", name: "Martillo de uña", category: "Herramientas", price: 180, costPrice: 120, stock: 20, minStock: 5, supplierId: "" },
  { id: "p2", code: "C-001", name: "Cemento gris", category: "Construcción", price: 250, costPrice: 200, stock: 3, minStock: 10, supplierId: "" },
  { id: "p3", code: "P-001", name: "Brocha 3 pulgadas", category: "Pinturas", price: 45, costPrice: 26, stock: 0, minStock: 5, supplierId: "" },
]

function renderProducts(productos = PRODUCTOS) {
  return renderizarPantalla(
    <AuthProvider>
      <ProductProvider>
        <Products />
      </ProductProvider>
    </AuthProvider>,
    { productos, esperar: ["productos_con_stock"] }
  )
}

const buscar = (texto) =>
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
    target: { value: texto },
  })

describe("Products", () => {
  it("lista los productos del inventario", async () => {
    await renderProducts()

    expect(screen.getByText("Martillo de uña")).toBeInTheDocument()
    expect(screen.getByText("Cemento gris")).toBeInTheDocument()
  })

  it("marca disponible el producto con stock suficiente", async () => {
    await renderProducts()
    expect(screen.getByText("Disponible")).toBeInTheDocument()
  })

  it("marca stock bajo cuando llega al mínimo", async () => {
    await renderProducts()
    expect(screen.getByText("Stock bajo")).toBeInTheDocument()
  })

  it("marca agotado cuando no queda nada", async () => {
    await renderProducts()
    expect(screen.getByText("Agotado")).toBeInTheDocument()
  })

  it("filtra por nombre", async () => {
    await renderProducts()
    buscar("martillo")

    expect(screen.getByText("Martillo de uña")).toBeInTheDocument()
    expect(screen.queryByText("Cemento gris")).not.toBeInTheDocument()
  })

  it("filtra por categoría", async () => {
    await renderProducts()
    buscar("pinturas")

    expect(screen.getByText("Brocha 3 pulgadas")).toBeInTheDocument()
    expect(screen.queryByText("Martillo de uña")).not.toBeInTheDocument()
  })

  it("filtra por código", async () => {
    await renderProducts()
    buscar("C-001")

    expect(screen.getByText("Cemento gris")).toBeInTheDocument()
    expect(screen.queryByText("Martillo de uña")).not.toBeInTheDocument()
  })

  it("abre el formulario de producto nuevo", async () => {
    await renderProducts()

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }))

    expect(
      screen.getByRole("heading", { name: /nuevo producto/i })
    ).toBeInTheDocument()
  })

  it("ofrece editar cada producto listado", async () => {
    await renderProducts()

    expect(screen.getAllByRole("button", { name: /editar/i })).toHaveLength(3)
  })
})
