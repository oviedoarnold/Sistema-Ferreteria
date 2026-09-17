import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, screen, within } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import SalesProvider from "../context/SalesContext"
import ClientsProvider from "../context/ClientsContext"
import { renderizarPantalla } from "../test/pantallas"
import { RUTA_PROYECCION } from "../lib/api/proyeccion"
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
  El Dashboard carga la proyección por su cuenta. Sin simularla, cada prueba
  intentaría descargar el archivo de verdad y dejaría el registro lleno de
  errores de red que no tienen nada que ver con lo que se prueba.
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
  Cada barra se mide contra el mes que más vendió, no contra la venta más
  grande: un mes con varias ventas chicas supera a cualquiera de ellas, y
  medido así todas las barras quedaban al tope.
*/
describe("gráfica de ventas por mes", () => {
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 10, 12)

  const barraDel = (fecha) =>
    document.querySelector(`[data-mes="${fecha.getFullYear()}-${fecha.getMonth() + 1}"] .bar`)

  it("dibuja cada mes en proporción al mes que más vendió", async () => {
    await renderDashboard({
      ventas: [
        venta({ id: "F-1" }),
        venta({ id: "F-2" }),
        venta({ id: "F-3", total: 300, timestamp: mesAnterior.getTime(), date: mesAnterior.toLocaleDateString("es-HN") }),
      ],
    })

    expect(barraDel(hoy).style.height).toBe("100%")
    expect(parseFloat(barraDel(mesAnterior).style.height)).toBeCloseTo((300 / 414) * 100, 5)
    expect(barraDel(hoy).closest(".bar-col")).toHaveTextContent("L 414.00")
  })

  it("deja visible pero mínima la barra de un mes sin ventas, y lo dice", async () => {
    await renderDashboard({ ventas: [venta()] })

    const mesesSinVentas = screen.getAllByRole("img", { name: /sin ventas/ })

    expect(mesesSinVentas).toHaveLength(5)
    expect(mesesSinVentas[0].style.height).toBe("4%")
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
  Un solo Dashboard: la operación de la ferretería y, debajo, el análisis y la
  proyección. Son fuentes distintas y así se presentan.
*/
describe("Dashboard ejecutivo", () => {
  const seccionDeProyeccion = async () =>
    (await screen.findByRole("heading", { name: "Análisis y proyección" })).closest("section")

  it("presenta el resumen operativo, de inventario y de proyección", async () => {
    await renderDashboard()

    expect(screen.getByRole("heading", { level: 2, name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByText(/Resumen operativo, inventario y proyección de demanda/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Operación actual" })).toBeInTheDocument()
  })

  it("conserva todas sus secciones operativas", async () => {
    await renderDashboard({ ventas: [venta()] })

    for (const etiqueta of ["Ventas hoy", "Ventas del mes", "Stock bajo", "Agotados", "Por cobrar", "Productos"]) {
      expect(screen.getByText(etiqueta, { selector: ".label" })).toBeInTheDocument()
    }

    for (const titulo of ["Ventas registradas por mes", "Top productos vendidos", "Últimas ventas", "Clientes"]) {
      expect(screen.getByText(titulo, { selector: ".chart-title" })).toBeInTheDocument()
    }
  })

  it("integra la proyección con sus indicadores, gráficas y recomendaciones", async () => {
    await renderDashboard({ ventas: [venta()] })

    const seccion = await seccionDeProyeccion()

    expect(await within(seccion).findByText("Recomendaciones de inventario")).toBeInTheDocument()
    expect(within(seccion).getByText("Demanda histórica y proyección")).toBeInTheDocument()
    expect(within(seccion).getByText("Distribución de riesgo")).toBeInTheDocument()
    expect(within(seccion).getByRole("combobox", { name: "Categoría" })).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith(RUTA_PROYECCION)
  })

  /*
    Ventas registradas y demanda del modelo son fuentes distintas: filtrar la
    proyección no toca las cifras de la operación.
  */
  it("los filtros de la proyección no cambian las cifras de la operación", async () => {
    await renderDashboard({ ventas: [venta()] })

    const seccion = await seccionDeProyeccion()
    await within(seccion).findByText("Recomendaciones de inventario")

    fireEvent.change(within(seccion).getByRole("combobox", { name: "Categoría" }), { target: { value: "Plomería" } })

    expect(screen.getByText("Ventas hoy").closest(".stat-card")).toHaveTextContent("L 207.00")
    expect(screen.getByText("Productos", { selector: ".label" }).closest(".stat-card")).toHaveTextContent("3")
    expect(within(seccion).getByText("Mostrando 4 de 4 productos")).toBeInTheDocument()
  })

  it("no muestra avisos académicos ni el origen de los productos", async () => {
    await renderDashboard({ ventas: [venta()] })

    await within(await seccionDeProyeccion()).findByText("Recomendaciones de inventario")

    expect(document.body).not.toHaveTextContent(/acad[eé]mic|simulad|Random Forest/i)
    expect(screen.queryByText("Simulado")).not.toBeInTheDocument()
    expect(screen.queryByText("Sistema")).not.toBeInTheDocument()
  })

  /*
    Si la proyección no carga, la ferretería tiene que poder seguir usando el
    Dashboard para operar.
  */
  it.each([
    ["el archivo responde con error", { estado: 500 }],
    ["no hay red", { falla: new TypeError("Failed to fetch") }],
  ])("si %s, solo el bloque de proyección lo avisa", async (_, falla) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    servirProyeccion(vi, falla)

    await renderDashboard({ ventas: [venta()] })

    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar la proyección de demanda.")
    expect(screen.getByText("Ventas hoy").closest(".stat-card")).toHaveTextContent("L 207.00")
    expect(screen.getByText("Agotados").closest(".stat-card")).toHaveTextContent("1")
    expect(screen.getByText("Últimas ventas")).toBeInTheDocument()
    expect(screen.queryByText("Recomendaciones de inventario")).not.toBeInTheDocument()
  })
})
