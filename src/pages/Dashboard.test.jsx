import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, within } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import SalesProvider from "../context/SalesContext"
import ClientsProvider from "../context/ClientsContext"
import { renderizarPantalla } from "../test/pantallas"
import { servirProyeccion } from "../test/proyeccionDePrueba"
import Dashboard from "./Dashboard"

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const PRODUCTOS = [
  { id: "p1", name: "Martillo", category: "Herramientas", price: 180, stock: 20, minStock: 5 },
  { id: "p2", name: "Cemento", category: "Construcción", price: 250, stock: 3, minStock: 10 },
  { id: "p3", name: "Brocha", category: "Pinturas", price: 45, stock: 0, minStock: 5 },
]

const hoy = new Date()

const venta = (extra = {}) => ({
  id: "F-1",
  invoiceNumber: "FAC-01000",
  date: hoy.toLocaleDateString("es-HN"),
  timestamp: hoy.getTime(),
  clientName: "Ferremax",
  items: [{ productId: "p1", name: "Martillo", qty: 1, price: 180, subtotal: 180 }],
  subtotal: 180,
  tax: 27,
  total: 207,
  paymentType: "contado",
  type: "contado",
  status: "pagada",
  ...extra,
})

/*
  El Dashboard carga la proyección de demanda por su cuenta. Sin simularla,
  cada prueba intentaría descargar el archivo de verdad y dejaría el registro
  lleno de errores de red que no tienen nada que ver con lo que se prueba.
*/
beforeEach(() => {
  servirProyeccion(vi)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderDashboard({ ventas = [], productos = PRODUCTOS, clientes = [] } = {}) {
  return renderizarPantalla(
    <AuthProvider>
      <ProductProvider>
        <ClientsProvider>
          <SalesProvider>
            <Dashboard />
          </SalesProvider>
        </ClientsProvider>
      </ProductProvider>
    </AuthProvider>,
    { ventas, productos, clientes, esperar: ["ventas"] }
  )
}

describe("Dashboard", () => {
  it("muestra el encabezado", async () => {
    await renderDashboard()
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("cuenta como stock bajo solo lo que aun tiene existencias", async () => {
    await renderDashboard()

    const tarjeta = screen.getByText("Stock bajo").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("1")
  })

  it("cuenta los productos agotados", async () => {
    await renderDashboard()

    const tarjeta = screen.getByText("Agotados").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("1")
  })

  it("informa cuántos productos hay", async () => {
    await renderDashboard()

    const tarjeta = screen.getByText("Productos").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("3")
  })

  it("suma las ventas del día", async () => {
    await renderDashboard({ ventas: [venta()] })

    const tarjeta = screen.getByText("Ventas hoy").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("207.00")
  })

  it("deja el saldo por cobrar en cero si todo es de contado", async () => {
    await renderDashboard({ ventas: [venta()] })

    const tarjeta = screen.getByText("Por cobrar").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("0.00")
  })

  it("suma al por cobrar solo el saldo pendiente de las ventas a crédito", async () => {
    const aCredito = venta({
      id: "F-2",
      paymentType: "credito",
      type: "credito",
      status: "pendiente",
      total: 1000,
      payments: [{ id: "ab1", amount: 400 }],
    })

    await renderDashboard({ ventas: [aCredito] })

    const tarjeta = screen.getByText("Por cobrar").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("600.00")
  })

  it("avisa cuando todavía no hay ventas", async () => {
    await renderDashboard()
    expect(screen.getAllByText(/sin ventas todav/i).length).toBeGreaterThan(0)
  })

  it("lista los productos más vendidos", async () => {
    await renderDashboard({ ventas: [venta()] })

    expect(screen.getByText("Top productos vendidos")).toBeInTheDocument()
    expect(screen.getByText("Martillo")).toBeInTheDocument()
  })
})

/*
  El tablero mide el negocio. Una factura anulada se deshizo, así que no es
  ingreso ni mercadería vendida, pero sigue siendo algo que pasó: por eso
  aparece en la actividad reciente y en ninguna cifra.
*/
describe("Dashboard con ventas anuladas", () => {
  const anulada = (extra = {}) =>
    venta({
      id: "F-anulada",
      invoiceNumber: "FAC-01099",
      clientName: "Distribuidora Sur",
      status: "anulada",
      total: 5000,
      items: [
        { productId: "p2", name: "Cemento", qty: 40, price: 250, subtotal: 10000 },
      ],
      ...extra,
    })

  it("no la suma a las ventas de hoy", async () => {
    await renderDashboard({ ventas: [venta(), anulada()] })

    const tarjeta = screen.getByText("Ventas hoy").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("L 207.00")
    expect(tarjeta).not.toHaveTextContent("5,207.00")
  })

  it("no la suma a las ventas del mes", async () => {
    await renderDashboard({ ventas: [venta(), anulada()] })

    const tarjeta = screen.getByText("Ventas del mes").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("L 207.00")
  })

  it("no la deja en las cuentas por cobrar", async () => {
    await renderDashboard({
      ventas: [
        anulada({
          paymentType: "credito",
          type: "credito",
          dueDate: "2027-01-31",
        }),
      ],
    })

    const tarjeta = screen.getByText("Por cobrar").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("L 0.00")
  })

  /*
    Sin este filtro, el producto de una factura anulada encabezaba el
    ranking por una venta que no ocurrió.
  */
  it("no la cuenta entre los productos más vendidos", async () => {
    await renderDashboard({ ventas: [venta(), anulada()] })

    const lista = screen
      .getByText("Top productos vendidos")
      .closest(".chart-wrap")

    expect(lista).toHaveTextContent("Martillo")
    expect(lista).not.toHaveTextContent("Cemento")
  })

  it("la conserva en la actividad reciente, marcada", async () => {
    await renderDashboard({ ventas: [venta(), anulada()] })

    const recientes = screen
      .getByText("Últimas ventas")
      .closest(".chart-wrap")

    expect(recientes).toHaveTextContent("Distribuidora Sur")
    expect(recientes).toHaveTextContent("Anulada")
  })
})


/*
  La proyección de demanda carga su propio archivo, aparte de los datos de la
  operación. Por omisión se sirve bien; las pruebas de falla la rompen a
  propósito.
*/
describe("Dashboard con la proyección de demanda", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("muestra la proyección debajo de los indicadores de la operación", async () => {
    await renderDashboard({ ventas: [venta()] })

    const seccion = (await screen.findByText("Proyección de demanda e inventario")).closest("section")

    expect(await within(seccion).findByText("Recomendaciones de inventario")).toBeInTheDocument()
    expect(within(seccion).getByText("Productos en riesgo alto").closest(".stat-card")).toHaveTextContent("28")

    // Los indicadores de la operación siguen fuera de la sección y con sus datos.
    expect(within(seccion).queryByText("Ventas hoy")).not.toBeInTheDocument()
    expect(screen.getByText("Ventas hoy").closest(".stat-card")).toHaveTextContent("L 207.00")
  })

  /*
    Lo más importante de la integración: si la proyección no carga, la
    ferretería tiene que poder seguir usando el Dashboard para operar.
  */
  it("si la proyección falla, el Dashboard operativo sigue funcionando", async () => {
    servirProyeccion(vi, { estado: 500 })

    await renderDashboard({ ventas: [venta()] })

    expect(await screen.findByText("No fue posible cargar la proyección de demanda.")).toBeInTheDocument()

    expect(screen.getByText("Ventas hoy").closest(".stat-card")).toHaveTextContent("L 207.00")
    expect(screen.getByText("Agotados").closest(".stat-card")).toHaveTextContent("1")
    expect(screen.getByText("Últimas ventas")).toBeInTheDocument()
    expect(screen.queryByText("Recomendaciones de inventario")).not.toBeInTheDocument()
  })

  it("si no hay red para la proyección, tampoco se cae la pantalla", async () => {
    servirProyeccion(vi, { falla: new TypeError("Failed to fetch") })

    await renderDashboard()

    expect(await screen.findByText("No fue posible cargar la proyección de demanda.")).toBeInTheDocument()
    expect(screen.getByText("Stock bajo").closest(".stat-card")).toHaveTextContent("1")
  })
})
