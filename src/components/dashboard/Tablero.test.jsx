import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import Tablero from "./Tablero"
import { MENSAJE_SIN_PROYECCION, RUTA_PROYECCION } from "../../lib/api/proyeccion"
import { resumirOperacion } from "../../utils/operacion"
import { ORDEN_ESPERADO, PRODUCTOS_DE_PRUEBA, proyeccionDePrueba, servirProyeccion } from "../../test/proyeccionDePrueba"

const PUBLICADO = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", RUTA_PROYECCION), "utf8")
)

const OPERACION = resumirOperacion({
  productos: [
    { id: "p1", name: "Martillo", stock: 20, minStock: 5 },
    { id: "p2", name: "Cemento", stock: 3, minStock: 10 },
    { id: "p3", name: "Brocha", stock: 0, minStock: 5 },
  ],
  ventas: [
    {
      id: "F-1",
      timestamp: Date.now(),
      clientName: "Ferremax",
      items: [{ name: "Martillo", qty: 2 }],
      total: 207,
      status: "pagada",
    },
  ],
  clientes: [{ id: "c1", name: "Ferremax", phone: "9999-0000" }],
})

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const abrirVista = (nombre) => fireEvent.click(screen.getByRole("tab", { name: nombre }))

async function mostrarTablero(opciones, vista = "Resumen") {
  servirProyeccion(vi, opciones)
  render(<Tablero operacion={OPERACION} />)

  await screen.findByText("Distribución de riesgo")
  abrirVista(vista)
}

const kpi = (etiqueta) => screen.getByText(etiqueta, { selector: ".kpi-etiqueta" }).closest(".kpi")

const selector = (nombre) => screen.getByRole("combobox", { name: nombre })

const elegir = (nombre, valor) => fireEvent.change(selector(nombre), { target: { value: valor } })

const estadoDeFiltros = () => document.querySelector(".filtros-estado")

const codigosEnLaTabla = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((fila) => fila.querySelector(".product-cat").textContent)

const ranking = (nombre = "Top 10 demanda proyectada — 30 días") => screen.getByRole("list", { name: nombre })

const codigosDe = (lista) =>
  within(lista)
    .getAllByRole("listitem")
    .map((fila) => fila.querySelector(".barra-h-detalle").textContent)

const categoriasDeInversion = () =>
  within(screen.getByRole("list", { name: "Inversión recomendada por categoría" }))
    .getAllByRole("listitem")
    .map((fila) => [fila.querySelector(".barra-h-nombre").firstChild.textContent, fila.querySelector(".barra-h-valor").textContent])

const leyendaDeRiesgo = () =>
  within(document.querySelector(".distribucion-riesgo"))
    .getAllByRole("listitem")
    .map((fila) => fila.textContent)

const segmentoDeRiesgo = (etiqueta) => screen.getByRole("button", { name: new RegExp(`^Riesgo ${etiqueta}:`) })

const barraDeCategoria = (categoria) => screen.getByRole("button", { name: new RegExp(`^${categoria}`) })

describe("navegación entre vistas", () => {
  it("abre en el Resumen y ofrece las cinco vistas", async () => {
    await mostrarTablero()

    expect(screen.getAllByRole("tab").map((pestana) => pestana.textContent)).toEqual([
      "Resumen", "Ventas", "Inventario", "Proyección", "Detalle",
    ])
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "pestana-resumen")
  })

  it("el Resumen reúne las cifras clave de la operación y de la proyección", async () => {
    await mostrarTablero()

    expect(screen.getAllByText(/./, { selector: ".kpi-etiqueta" }).map((etiqueta) => etiqueta.textContent)).toEqual([
      "Ventas hoy", "Ventas del mes", "Por cobrar", "Stock bajo", "Demanda 30 días", "Riesgo alto",
    ])
    expect(kpi("Ventas hoy")).toHaveTextContent("L 207.00")
    expect(kpi("Demanda 30 días")).toHaveTextContent("690.0unidades67.0 en 7 días")
    expect(ranking("Top 5 demanda proyectada — 30 días")).toBeInTheDocument()
    expect(screen.getByText("Demanda histórica y proyección")).toBeInTheDocument()
    expect(screen.getByText("Ventas registradas por mes")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText("Últimas ventas")).not.toBeInTheDocument()
  })

  it("muestra una sola vista a la vez", async () => {
    await mostrarTablero()

    abrirVista("Ventas")

    expect(screen.getAllByRole("tabpanel")).toHaveLength(1)
    expect(screen.getByRole("tab", { name: "Ventas" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "false")
    expect(screen.queryByText("Distribución de riesgo")).not.toBeInTheDocument()
  })

  it("Ventas reúne la operación y no muestra los filtros de la proyección", async () => {
    await mostrarTablero({}, "Ventas")

    expect(kpi("Clientes")).toHaveTextContent("1")
    expect(screen.getByText("Últimas ventas")).toBeInTheDocument()
    expect(screen.getAllByText("Ferremax", { selector: ".dash-mini-row .name" })).toHaveLength(2)
    expect(screen.queryByRole("group", { name: "Filtros de la proyección" })).not.toBeInTheDocument()
  })

  it("Inventario reúne existencias, riesgo, inversión y prioridad de reposición", async () => {
    await mostrarTablero({}, "Inventario")

    expect(kpi("Productos")).toHaveTextContent("3")
    expect(kpi("Agotados")).toHaveTextContent("1producto")
    expect(kpi("Con reposición")).toHaveTextContent("8productosde 12 productos proyectados")
    expect(screen.getByText("Distribución de riesgo")).toBeInTheDocument()
    expect(screen.getByText("Inversión recomendada por categoría")).toBeInTheDocument()
    expect(codigosDe(ranking("Prioridad de reposición — top 10"))).toEqual(ORDEN_ESPERADO.slice(0, 8))
  })

  it("Proyección muestra sus cinco cifras, los períodos y las cuatro gráficas", async () => {
    await mostrarTablero({}, "Proyección")

    expect(screen.getByRole("heading", { name: "Proyección de demanda" })).toBeInTheDocument()
    expect(screen.getByText("Histórico: enero–agosto 2026 · Proyección: septiembre 2026")).toBeInTheDocument()
    expect(screen.getAllByText(/./, { selector: ".kpi-etiqueta" }).map((etiqueta) => etiqueta.textContent)).toEqual([
      "Demanda 7 días", "Demanda 30 días", "Riesgo alto", "Reposición", "Inversión estimada",
    ])
    for (const titulo of [
      "Demanda histórica y proyección", "Distribución de riesgo",
      "Top 10 demanda proyectada — 30 días", "Inversión recomendada por categoría",
    ]) {
      expect(screen.getByText(titulo)).toBeInTheDocument()
    }
  })

  it("Detalle muestra la tabla de recomendaciones", async () => {
    await mostrarTablero({}, "Detalle")

    expect(screen.getByText("Recomendaciones de inventario")).toBeInTheDocument()
    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
    expect(screen.queryByText("Distribución de riesgo")).not.toBeInTheDocument()
  })

  /*
    Los filtros son del Dashboard, no de una vista: se eligen una vez y siguen
    aplicados al recorrer las demás.
  */
  it("conserva los filtros al pasar de una vista a otra", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")
    elegir("Riesgo", "alto")

    abrirVista("Inventario")
    expect(kpi("Con reposición")).toHaveTextContent("3productosde 3 productos proyectados")

    abrirVista("Ventas")
    abrirVista("Proyección")

    expect(selector("Categoría")).toHaveValue("Plomería")
    expect(selector("Riesgo")).toHaveValue("alto")
    expect(estadoDeFiltros()).toHaveTextContent("Plomería · Riesgo alto · 3 de 12 productos")

    fireEvent.click(screen.getByRole("button", { name: "Restablecer filtros" }))
    abrirVista("Detalle")

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
  })

  it("en el Resumen los filtros cambian las cifras de la proyección, no las de la operación", async () => {
    await mostrarTablero()

    elegir("Categoría", "Plomería")

    expect(kpi("Demanda 30 días")).toHaveTextContent("312.0unidades8.0 en 7 días")
    expect(kpi("Riesgo alto")).toHaveTextContent("3productos75% de 4 productos")
    expect(kpi("Ventas hoy")).toHaveTextContent("L 207.00")
    expect(kpi("Stock bajo")).toHaveTextContent("1producto1 agotado")
    expect(codigosDe(ranking("Top 5 demanda proyectada — 30 días"))).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
  })
})

describe("encabezado y lenguaje", () => {
  /*
    La interfaz habla de negocio. Que el escenario sea académico se explica en
    la documentación y en la defensa, no en la pantalla.
  */
  it("no muestra avisos académicos, origen de los productos ni la nota del modelo", async () => {
    await mostrarTablero()

    for (const vista of ["Resumen", "Inventario", "Proyección", "Detalle"]) {
      abrirVista(vista)

      expect(document.body).not.toHaveTextContent(/acad[eé]mic|simulad|escenario|Random Forest|backtesting/i)
      expect(document.body).not.toHaveTextContent(/precisión|exactitud|superior|tiempo real|garantizad/i)
      expect(screen.queryByText("Sistema")).not.toBeInTheDocument()
    }
  })
})

/*
  Con el archivo publicado de verdad: sin filtros, y después de restablecer,
  la pantalla tiene que mostrar exactamente los resultados aprobados.
*/
describe("con el archivo publicado", () => {
  const cifrasAprobadas = () => {
    expect(estadoDeFiltros()).toHaveTextContent("50 productos")
    expect(kpi("Demanda 7 días")).toHaveTextContent("570.1unidades")
    expect(kpi("Demanda 30 días")).toHaveTextContent("2,470.9unidades")
    expect(kpi("Riesgo alto")).toHaveTextContent("28productos56% de 50 productos")
    expect(kpi("Reposición")).toHaveTextContent("34productos1,286 unidades recomendadas")
    expect(kpi("Inversión estimada")).toHaveTextContent("L 119,380.60")
    expect(leyendaDeRiesgo()).toEqual(["Alto2856%", "Medio612%", "Bajo1632%", "Total50"])
    expect(document.querySelector(".barras-h-pie")).toHaveTextContent("TotalL 119,380.60")
  }

  it("muestra los resultados aprobados sin filtros", async () => {
    await mostrarTablero({ datos: PUBLICADO }, "Proyección")

    cifrasAprobadas()

    abrirVista("Detalle")
    expect(screen.getByText("10 prioritarios de 50 productos")).toBeInTheDocument()
  })

  it("'Restablecer filtros' vuelve exactamente a los resultados aprobados", async () => {
    await mostrarTablero({ datos: PUBLICADO }, "Proyección")

    elegir("Categoría", "Plomería")
    elegir("Riesgo", "alto")
    expect(kpi("Inversión estimada")).not.toHaveTextContent("L 119,380.60")

    fireEvent.click(screen.getByRole("button", { name: "Restablecer filtros" }))

    expect(selector("Categoría")).toHaveValue("todas")
    expect(selector("Riesgo")).toHaveValue("todos")
    cifrasAprobadas()
  })
})

describe("filtro de categoría", () => {
  it("recalcula las cifras con los productos de la categoría", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")

    expect(estadoDeFiltros()).toHaveTextContent("Plomería · 4 de 12 productos")
    expect(kpi("Demanda 7 días")).toHaveTextContent("8.0unidades")
    expect(kpi("Demanda 30 días")).toHaveTextContent("312.0unidades")
    expect(kpi("Riesgo alto")).toHaveTextContent("3productos75% de 4 productos")
    expect(kpi("Reposición")).toHaveTextContent("3productos170 unidades recomendadas")
    expect(kpi("Inversión estimada")).toHaveTextContent("L 3,200.00")
  })

  it("filtra la distribución de riesgo, el top, el histórico y la tabla", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")

    expect(leyendaDeRiesgo()).toEqual(["Alto375%", "Medio00%", "Bajo125%", "Total4"])
    expect(codigosDe(ranking())).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
    expect(screen.getByRole("img", { name: "ene: 260 unidades" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ago: 288 unidades" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "sep: 312 unidades (proyección)" })).toBeInTheDocument()

    abrirVista("Detalle")

    expect(codigosEnLaTabla()).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
    expect(screen.getByText("Mostrando 4 de 4 productos")).toBeInTheDocument()
  })

  /*
    Las barras de categoría no se filtran por su propio filtro: siguen
    mostrando todas las categorías, con la elegida marcada, para poder cambiar
    de una a otra con un clic.
  */
  it("marca la categoría elegida en la inversión sin ocultar las demás", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")

    expect(categoriasDeInversion()).toHaveLength(5)
    expect(barraDeCategoria("Plomería")).toHaveAttribute("aria-pressed", "true")
    expect(barraDeCategoria("Construcción")).toHaveAttribute("aria-pressed", "false")
  })
})

describe("filtro de riesgo", () => {
  it("recalcula cifras y tabla con los productos de ese riesgo", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Riesgo", "alto")

    expect(estadoDeFiltros()).toHaveTextContent("Riesgo alto · 6 de 12 productos")
    expect(kpi("Demanda 30 días")).toHaveTextContent("613.9unidades")
    expect(kpi("Riesgo alto")).toHaveTextContent("100% de 6 productos")
    expect(kpi("Reposición")).toHaveTextContent("493 unidades recomendadas")
    expect(kpi("Inversión estimada")).toHaveTextContent("L 48,458.00")

    abrirVista("Detalle")

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 6))
  })

  it("deja en la inversión solo las categorías con productos de ese riesgo", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Riesgo", "alto")

    expect(categoriasDeInversion()).toEqual([
      ["Construcción", "L 38,808.00"],
      ["Tornillería", "L 6,300.00"],
      ["Plomería", "L 3,200.00"],
      ["Jardinería", "L 150.00"],
    ])
    expect(segmentoDeRiesgo("alto")).toHaveAttribute("aria-pressed", "true")
  })

  it("avisa cuando ningún producto del filtro necesita reposición", async () => {
    await mostrarTablero({}, "Inventario")

    elegir("Riesgo", "bajo")

    expect(screen.getAllByText("Ningún producto de este filtro necesita reposición.")).toHaveLength(2)
    expect(kpi("Con reposición")).toHaveTextContent("0productos")
  })
})

describe("categoría y riesgo combinados", () => {
  it("muestra la intersección de los dos filtros", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")
    elegir("Riesgo", "alto")

    expect(estadoDeFiltros()).toHaveTextContent("Plomería · Riesgo alto · 3 de 12 productos")
    expect(codigosDe(ranking())).toEqual(["FER-020", "FER-022", "FER-021"])
    expect(kpi("Demanda 30 días")).toHaveTextContent("300.0unidades")
    expect(kpi("Inversión estimada")).toHaveTextContent("L 3,200.00")
    expect(screen.getByRole("img", { name: "ene: 250 unidades" })).toBeInTheDocument()

    abrirVista("Detalle")

    expect(codigosEnLaTabla()).toEqual(["FER-020", "FER-022", "FER-021"])
  })

  it("sin coincidencias lo dice en cada vista, sin cifras, y permite restablecer", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Cerrajería")
    elegir("Riesgo", "alto")

    const aviso = "No hay productos que coincidan con los filtros seleccionados."

    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(kpi("Demanda 30 días")).toHaveTextContent("—Sin coincidencias")
    expect(screen.queryByText("Distribución de riesgo")).not.toBeInTheDocument()

    abrirVista("Resumen")

    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(kpi("Riesgo alto")).toHaveTextContent("—Sin coincidencias")
    expect(kpi("Ventas hoy")).toHaveTextContent("L 207.00")
    expect(screen.getByText("Ventas registradas por mes")).toBeInTheDocument()

    abrirVista("Detalle")

    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restablecer filtros" }))

    expect(codigosEnLaTabla()).toHaveLength(10)
  })
})

describe("filtrar desde las gráficas", () => {
  it("un clic en un segmento de la dona filtra por ese riesgo, y otro lo quita", async () => {
    await mostrarTablero({}, "Proyección")

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(selector("Riesgo")).toHaveValue("medio")
    expect(segmentoDeRiesgo("medio")).toHaveAttribute("aria-pressed", "true")
    expect(kpi("Inversión estimada")).toHaveTextContent("L 21,000.00")

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(selector("Riesgo")).toHaveValue("todos")
    expect(segmentoDeRiesgo("medio")).toHaveAttribute("aria-pressed", "false")
  })

  it("la dona del Resumen también filtra, y la selección sigue en las demás vistas", async () => {
    await mostrarTablero()

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(kpi("Riesgo alto")).toHaveTextContent("0productos0% de 2 productos")

    abrirVista("Detalle")

    expect(codigosEnLaTabla()).toEqual(["FER-031", "FER-030"])
  })

  it("la dona de Inventario filtra por riesgo", async () => {
    await mostrarTablero({}, "Inventario")

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(selector("Riesgo")).toHaveValue("medio")
    expect(codigosDe(ranking("Prioridad de reposición — top 10"))).toEqual(["FER-031", "FER-030"])
  })

  it("las barras de categoría de Proyección filtran por categoría", async () => {
    await mostrarTablero({}, "Proyección")

    fireEvent.click(barraDeCategoria("Jardinería"))

    expect(selector("Categoría")).toHaveValue("Jardinería")
    expect(kpi("Demanda 30 días")).toHaveTextContent("38.0unidades")
  })

  it("los segmentos de la dona también se activan con el teclado", async () => {
    await mostrarTablero({}, "Proyección")

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: "Enter" })
    expect(selector("Riesgo")).toHaveValue("alto")

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: " " })
    expect(selector("Riesgo")).toHaveValue("todos")

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: "Tab" })
    expect(selector("Riesgo")).toHaveValue("todos")
  })

  it("la dona conserva la categoría elegida y resalta el riesgo", async () => {
    await mostrarTablero({}, "Proyección")

    elegir("Categoría", "Plomería")
    fireEvent.click(segmentoDeRiesgo("alto"))

    expect(leyendaDeRiesgo()).toEqual(["Alto375%", "Medio00%", "Bajo125%", "Total4"])
    expect(document.querySelector('.dona-leyenda li[data-riesgo="alto"]')).toHaveClass("elegido")
    expect(codigosDe(ranking())).toEqual(["FER-020", "FER-022", "FER-021"])
  })

  it("un clic en una categoría de la inversión filtra por ella, y otro lo quita", async () => {
    await mostrarTablero({}, "Inventario")

    fireEvent.click(barraDeCategoria("Plomería"))

    expect(selector("Categoría")).toHaveValue("Plomería")
    expect(codigosDe(ranking("Prioridad de reposición — top 10"))).toEqual(["FER-020", "FER-022", "FER-021"])
    expect(kpi("Con reposición")).toHaveTextContent("3productos")

    fireEvent.click(barraDeCategoria("Plomería"))

    expect(selector("Categoría")).toHaveValue("todas")
    expect(estadoDeFiltros()).toHaveTextContent("12 productos")
  })
})

describe("detalle al pasar el mouse", () => {
  it("cada producto del top trae código, demandas, stock, riesgo y recomendación", async () => {
    await mostrarTablero({}, "Proyección")

    const detalle = within(ranking()).getAllByRole("tooltip")[0]

    expect(detalle).toHaveTextContent("Cemento gris 42.5 kg · CEM-001")
    expect(detalle).toHaveTextContent("Demanda 7 días: 45.0 u.")
    expect(detalle).toHaveTextContent("Demanda 30 días: 205.7 u.")
    expect(detalle).toHaveTextContent("Stock: 60")
    expect(detalle).toHaveTextContent("Riesgo: Alto")
    expect(detalle).toHaveTextContent("Recomendación: Comprar 196")
  })

  it("la prioridad de reposición trae el mismo detalle por producto", async () => {
    await mostrarTablero({}, "Inventario")

    const [primero] = within(ranking("Prioridad de reposición — top 10")).getAllByRole("listitem")

    expect(primero).toHaveTextContent("Comprar 196")
    expect(within(primero).getByRole("tooltip")).toHaveTextContent("Recomendación: Comprar 196")
  })

  it("cada categoría trae inversión y productos con reposición", async () => {
    await mostrarTablero({}, "Proyección")

    const detalle = within(barraDeCategoria("Plomería")).getByRole("tooltip")

    expect(detalle).toHaveTextContent("Inversión: L 3,200.00")
    expect(detalle).toHaveTextContent("Con reposición: 3 productos")
  })

  it("los segmentos de la dona y las barras del histórico describen su valor", async () => {
    await mostrarTablero({}, "Proyección")

    expect(segmentoDeRiesgo("alto").querySelector("title")).toHaveTextContent("Alto: 6 productos (50%)")
    expect(document.querySelector('.bar-col[data-tipo="proyeccion"]')).toHaveAttribute(
      "title",
      "sep: 690 unidades (proyección)"
    )
  })
})

describe("gráfica de demanda histórica y proyección", () => {
  it("muestra ocho meses históricos y septiembre como proyección, rotulada en texto", async () => {
    await mostrarTablero({}, "Proyección")

    const historicos = document.querySelectorAll('.bar-col[data-tipo="historico"]')
    const septiembre = document.querySelector('.bar-col[data-tipo="proyeccion"]')

    expect(historicos).toHaveLength(8)
    expect(septiembre).toHaveTextContent("proy.")
    expect(septiembre.querySelector(".bar")).toHaveClass("secondary")
    expect(document.querySelector(".proyeccion-leyenda")).toHaveTextContent("HistóricoProyección")
  })

  it("mide cada barra contra el tope del eje", async () => {
    await mostrarTablero({}, "Proyección")

    const marcas = [...document.querySelectorAll(".grafica-eje span")].map((marca) => marca.textContent)
    const agosto = screen.getByRole("img", { name: "ago: 698 unidades" })

    expect(marcas).toEqual(["0", "200", "400", "600", "800"])
    expect(parseFloat(agosto.style.height)).toBeCloseTo((698 / 800) * 100, 5)
  })
})

describe("recomendaciones de inventario", () => {
  it("sin filtros muestra los 10 prioritarios, con riesgo en texto y sin origen", async () => {
    await mostrarTablero({}, "Detalle")

    expect(screen.getByText("10 prioritarios de 12 productos")).toBeInTheDocument()

    const fila = within(screen.getByRole("table")).getByText("CEM-001").closest("tr")

    expect(fila.querySelector(".badge")).toHaveTextContent("Alto")
    expect(fila).toHaveTextContent("Comprar 196")
    expect(fila).not.toHaveTextContent(/Sistema|Simulado/)
  })

  it("'Ver todos' muestra el resto sin filtros", async () => {
    await mostrarTablero({}, "Detalle")

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (12)" }))

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO)
    expect(screen.getByText("Mostrando 12 de 12 productos")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver solo 10" }))

    expect(codigosEnLaTabla()).toHaveLength(10)
  })

  it("'Ver todos' se refiere a los productos filtrados", async () => {
    const plomeria = Array.from({ length: 16 }, (_, i) => ({
      ...PRODUCTOS_DE_PRUEBA[2],
      producto_id: `plo-${i}`,
      codigo: `PLO-${String(i).padStart(3, "0")}`,
    }))

    await mostrarTablero({ datos: proyeccionDePrueba({ productos: [...PRODUCTOS_DE_PRUEBA, ...plomeria] }) }, "Detalle")

    expect(screen.getByRole("button", { name: "Ver todos (28)" })).toBeInTheDocument()

    elegir("Categoría", "Plomería")

    expect(screen.getByText("Mostrando 10 de 20 productos")).toBeInTheDocument()
    expect(screen.queryByText(/prioritarios/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (20)" }))

    expect(codigosEnLaTabla()).toHaveLength(20)
    expect(screen.getByText("Mostrando 20 de 20 productos")).toBeInTheDocument()
  })
})

describe("carga de la proyección", () => {
  it("indica que está cargando sin mostrar cifras de la proyección", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    render(<Tablero operacion={OPERACION} />)

    expect(screen.getByRole("status")).toHaveTextContent("Cargando proyección de demanda…")
    expect(kpi("Demanda 30 días")).toHaveTextContent("—Cargando…")
    expect(kpi("Ventas hoy")).toHaveTextContent("L 207.00")
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    expect(screen.queryByText("Cargando proyección de demanda…")).not.toBeInTheDocument()
    expect(kpi("Demanda 30 días")).toHaveTextContent("690.0unidades")
  })

  /*
    Ante cualquier falla, un aviso y nada más: una tarjeta en cero se leería
    como un resultado real.
  */
  it.each([
    ["sin conexión", { falla: new TypeError("Failed to fetch") }],
    ["con el archivo inexistente", { estado: 404 }],
    ["con una estructura incompleta", { datos: proyeccionDePrueba({ productos: [] }) }],
  ])("%s muestra el aviso sin cifras en cada vista predictiva", async (_, opciones) => {
    servirProyeccion(vi, opciones)

    render(<Tablero operacion={OPERACION} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar la proyección de demanda.")
    expect(kpi("Riesgo alto")).toHaveTextContent("—No disponible")
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()

    for (const vista of ["Inventario", "Proyección", "Detalle"]) {
      abrirVista(vista)
      expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar la proyección de demanda.")
    }
  })

  it("con un archivo que no es JSON muestra el mismo aviso", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    })

    render(<Tablero operacion={OPERACION} />)

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_SIN_PROYECCION)
  })

  /*
    Si el usuario sale del Dashboard antes de que llegue el archivo, la
    respuesta tardía no debe intentar actualizar una pantalla que ya no existe.
  */
  it("ignora una respuesta que llega después de salir", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    const { unmount } = render(<Tablero operacion={OPERACION} />)
    unmount()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    await waitFor(() => expect(console.error).not.toHaveBeenCalled())
  })

  it("ignora un error que llega después de salir", async () => {
    let fallar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((_, rechazar) => { fallar = rechazar }))

    const { unmount } = render(<Tablero operacion={OPERACION} />)
    unmount()

    await act(async () => {
      fallar(new TypeError("Failed to fetch"))
    })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
