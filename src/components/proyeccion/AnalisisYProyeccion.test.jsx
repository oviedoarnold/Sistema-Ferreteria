import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import AnalisisYProyeccion from "./AnalisisYProyeccion"
import { MENSAJE_SIN_PROYECCION, RUTA_PROYECCION } from "../../lib/api/proyeccion"
import { ORDEN_ESPERADO, PRODUCTOS_DE_PRUEBA, proyeccionDePrueba, servirProyeccion } from "../../test/proyeccionDePrueba"

const PUBLICADO = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", RUTA_PROYECCION), "utf8")
)

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mostrarProyeccion(opciones) {
  servirProyeccion(vi, opciones)
  render(<AnalisisYProyeccion />)

  await screen.findByText("Recomendaciones de inventario")
}

const tarjeta = (etiqueta) => screen.getByText(etiqueta, { selector: ".label" }).closest(".stat-card")

const selector = (nombre) => screen.getByRole("combobox", { name: nombre })

const elegir = (nombre, valor) => fireEvent.change(selector(nombre), { target: { value: valor } })

const estadoDeFiltros = () => document.querySelector(".filtros-estado")

const codigosEnLaTabla = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((fila) => fila.querySelector(".product-cat").textContent)

const ranking = () => screen.getByRole("list", { name: "Top 10 demanda proyectada — 30 días" })

const codigosDelRanking = () =>
  within(ranking())
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

describe("encabezado y lenguaje", () => {
  it("presenta el bloque con sus períodos", async () => {
    await mostrarProyeccion()

    expect(screen.getByRole("heading", { name: "Análisis y proyección" })).toBeInTheDocument()
    expect(screen.getByText("Histórico: enero–agosto 2026 · Proyección: septiembre 2026")).toBeInTheDocument()
  })

  /*
    La interfaz habla de negocio. Que el escenario sea académico se explica en
    la documentación y en la defensa, no en la pantalla.
  */
  it("no muestra avisos académicos, origen de los productos ni la nota del modelo", async () => {
    await mostrarProyeccion()

    expect(document.body).not.toHaveTextContent(/acad[eé]mic|simulad|escenario|Random Forest|backtesting/i)
    expect(screen.queryByText("Sistema")).not.toBeInTheDocument()
    expect(document.querySelector(".origen-producto")).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/precisión|exactitud|superior|tiempo real|garantizad/i)
  })
})

/*
  Con el archivo publicado de verdad: sin filtros, y después de restablecer,
  la pantalla tiene que mostrar exactamente los resultados aprobados.
*/
describe("con el archivo publicado", () => {
  const cifrasAprobadas = () => {
    expect(estadoDeFiltros()).toHaveTextContent("50 productos")
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("2,470.9unidades")
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("570.1 unidades / 7 días")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("28productos")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("56% de 50 productos")
    expect(tarjeta("Reposición")).toHaveTextContent("34productos")
    expect(tarjeta("Reposición")).toHaveTextContent("1,286 unidades recomendadas")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 119,380.60")
    expect(leyendaDeRiesgo()).toEqual(["Alto2856%", "Medio612%", "Bajo1632%", "Total50"])
    expect(document.querySelector(".barras-h-pie")).toHaveTextContent("TotalL 119,380.60")
    expect(screen.getByText("10 prioritarios de 50 productos")).toBeInTheDocument()
  }

  it("muestra los resultados aprobados sin filtros", async () => {
    await mostrarProyeccion({ datos: PUBLICADO })

    cifrasAprobadas()
  })

  it("'Restablecer filtros' vuelve exactamente a los resultados aprobados", async () => {
    await mostrarProyeccion({ datos: PUBLICADO })

    elegir("Categoría", "Plomería")
    elegir("Riesgo", "alto")
    expect(tarjeta("Inversión estimada")).not.toHaveTextContent("L 119,380.60")

    fireEvent.click(screen.getByRole("button", { name: "Restablecer filtros" }))

    expect(selector("Categoría")).toHaveValue("todas")
    expect(selector("Riesgo")).toHaveValue("todos")
    cifrasAprobadas()
  })
})

describe("filtro de categoría", () => {
  it("recalcula las tarjetas con los productos de la categoría", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Plomería")

    expect(estadoDeFiltros()).toHaveTextContent("Plomería · 4 de 12 productos")
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("312.0unidades")
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("8.0 unidades / 7 días")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("3productos")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("75% de 4 productos")
    expect(tarjeta("Reposición")).toHaveTextContent("3productos")
    expect(tarjeta("Reposición")).toHaveTextContent("170 unidades recomendadas")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 3,200.00")
  })

  it("filtra la distribución de riesgo, el top, el histórico y la tabla", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Plomería")

    expect(leyendaDeRiesgo()).toEqual(["Alto375%", "Medio00%", "Bajo125%", "Total4"])
    expect(codigosDelRanking()).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
    expect(codigosEnLaTabla()).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
    expect(screen.getByText("Mostrando 4 de 4 productos")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ene: 260 unidades" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ago: 288 unidades" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "sep: 312 unidades (proyección)" })).toBeInTheDocument()
  })

  /*
    Las barras de categoría no se filtran por su propio filtro: siguen
    mostrando todas las categorías, con la elegida marcada, para poder cambiar
    de una a otra con un clic.
  */
  it("marca la categoría elegida en la inversión sin ocultar las demás", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Plomería")

    expect(categoriasDeInversion()).toHaveLength(5)
    expect(barraDeCategoria("Plomería")).toHaveAttribute("aria-pressed", "true")
    expect(barraDeCategoria("Construcción")).toHaveAttribute("aria-pressed", "false")
  })
})

describe("filtro de riesgo", () => {
  it("recalcula tarjetas y tabla con los productos de ese riesgo", async () => {
    await mostrarProyeccion()

    elegir("Riesgo", "alto")

    expect(estadoDeFiltros()).toHaveTextContent("Riesgo alto · 6 de 12 productos")
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("613.9unidades")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("100% de 6 productos")
    expect(tarjeta("Reposición")).toHaveTextContent("493 unidades recomendadas")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 48,458.00")
    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 6))
  })

  it("deja en la inversión solo las categorías con productos de ese riesgo", async () => {
    await mostrarProyeccion()

    elegir("Riesgo", "alto")

    expect(categoriasDeInversion()).toEqual([
      ["Construcción", "L 38,808.00"],
      ["Tornillería", "L 6,300.00"],
      ["Plomería", "L 3,200.00"],
      ["Jardinería", "L 150.00"],
    ])
    expect(segmentoDeRiesgo("alto")).toHaveAttribute("aria-pressed", "true")
  })

  it("avisa en la inversión cuando ningún producto del filtro necesita reposición", async () => {
    await mostrarProyeccion()

    elegir("Riesgo", "bajo")

    expect(screen.getByText("Ningún producto de este filtro necesita reposición.")).toBeInTheDocument()
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 0.00")
  })
})

describe("categoría y riesgo combinados", () => {
  it("muestra la intersección de los dos filtros", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Plomería")
    elegir("Riesgo", "alto")

    expect(estadoDeFiltros()).toHaveTextContent("Plomería · Riesgo alto · 3 de 12 productos")
    expect(codigosEnLaTabla()).toEqual(["FER-020", "FER-022", "FER-021"])
    expect(codigosDelRanking()).toEqual(["FER-020", "FER-022", "FER-021"])
    expect(tarjeta("Demanda 30 días")).toHaveTextContent("300.0unidades")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 3,200.00")
    expect(screen.getByRole("img", { name: "ene: 250 unidades" })).toBeInTheDocument()
  })

  it("sin coincidencias lo dice, sin cifras, y permite restablecer", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Cerrajería")
    elegir("Riesgo", "alto")

    expect(screen.getByText("No hay productos que coincidan con los filtros seleccionados.")).toBeInTheDocument()
    expect(document.querySelector(".stat-card")).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: /Top 10/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restablecer filtros" }))

    expect(codigosEnLaTabla()).toHaveLength(10)
  })
})

describe("filtrar desde las gráficas", () => {
  it("un clic en un segmento de la dona filtra por ese riesgo, y otro lo quita", async () => {
    await mostrarProyeccion()

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(selector("Riesgo")).toHaveValue("medio")
    expect(segmentoDeRiesgo("medio")).toHaveAttribute("aria-pressed", "true")
    expect(codigosEnLaTabla()).toEqual(["FER-031", "FER-030"])
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 21,000.00")

    fireEvent.click(segmentoDeRiesgo("medio"))

    expect(selector("Riesgo")).toHaveValue("todos")
    expect(segmentoDeRiesgo("medio")).toHaveAttribute("aria-pressed", "false")
  })

  it("los segmentos de la dona también se activan con el teclado", async () => {
    await mostrarProyeccion()

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: "Enter" })
    expect(selector("Riesgo")).toHaveValue("alto")

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: " " })
    expect(selector("Riesgo")).toHaveValue("todos")

    fireEvent.keyDown(segmentoDeRiesgo("alto"), { key: "Tab" })
    expect(selector("Riesgo")).toHaveValue("todos")
  })

  it("la dona conserva la categoría elegida y resalta el riesgo", async () => {
    await mostrarProyeccion()

    elegir("Categoría", "Plomería")
    fireEvent.click(segmentoDeRiesgo("alto"))

    expect(leyendaDeRiesgo()).toEqual(["Alto375%", "Medio00%", "Bajo125%", "Total4"])
    expect(document.querySelector('.dona-leyenda li[data-riesgo="alto"]')).toHaveClass("elegido")
    expect(codigosEnLaTabla()).toEqual(["FER-020", "FER-022", "FER-021"])
  })

  it("un clic en una categoría de la inversión filtra por ella, y otro lo quita", async () => {
    await mostrarProyeccion()

    fireEvent.click(barraDeCategoria("Plomería"))

    expect(selector("Categoría")).toHaveValue("Plomería")
    expect(codigosDelRanking()).toEqual(["FER-020", "FER-022", "FER-021", "FER-040"])
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 3,200.00")

    fireEvent.click(barraDeCategoria("Plomería"))

    expect(selector("Categoría")).toHaveValue("todas")
    expect(estadoDeFiltros()).toHaveTextContent("12 productos")
  })
})

describe("detalle al pasar el mouse", () => {
  it("cada producto del top trae código, demandas, stock, riesgo y recomendación", async () => {
    await mostrarProyeccion()

    const detalle = within(ranking()).getAllByRole("tooltip")[0]

    expect(detalle).toHaveTextContent("Cemento gris 42.5 kg · CEM-001")
    expect(detalle).toHaveTextContent("Demanda 7 días: 45.0 u.")
    expect(detalle).toHaveTextContent("Demanda 30 días: 205.7 u.")
    expect(detalle).toHaveTextContent("Stock: 60")
    expect(detalle).toHaveTextContent("Riesgo: Alto")
    expect(detalle).toHaveTextContent("Recomendación: Comprar 196")
  })

  it("cada categoría trae inversión y productos con reposición", async () => {
    await mostrarProyeccion()

    const detalle = within(barraDeCategoria("Plomería")).getByRole("tooltip")

    expect(detalle).toHaveTextContent("Inversión: L 3,200.00")
    expect(detalle).toHaveTextContent("Con reposición: 3 productos")
  })

  it("los segmentos de la dona y las barras del histórico describen su valor", async () => {
    await mostrarProyeccion()

    expect(segmentoDeRiesgo("alto").querySelector("title")).toHaveTextContent("Alto: 6 productos (50%)")
    expect(document.querySelector('.bar-col[data-tipo="proyeccion"]')).toHaveAttribute(
      "title",
      "sep: 690 unidades (proyección)"
    )
  })
})

describe("gráfica de demanda histórica y proyección", () => {
  it("muestra ocho meses históricos y septiembre como proyección, rotulada en texto", async () => {
    await mostrarProyeccion()

    const historicos = document.querySelectorAll('.bar-col[data-tipo="historico"]')
    const septiembre = document.querySelector('.bar-col[data-tipo="proyeccion"]')

    expect(historicos).toHaveLength(8)
    expect(septiembre).toHaveTextContent("proy.")
    expect(septiembre.querySelector(".bar")).toHaveClass("secondary")
    expect(document.querySelector(".proyeccion-leyenda")).toHaveTextContent("HistóricoProyección")
  })

  it("mide cada barra contra el tope del eje", async () => {
    await mostrarProyeccion()

    const marcas = [...document.querySelectorAll(".grafica-eje span")].map((marca) => marca.textContent)
    const agosto = screen.getByRole("img", { name: "ago: 698 unidades" })

    expect(marcas).toEqual(["0", "200", "400", "600", "800"])
    expect(parseFloat(agosto.style.height)).toBeCloseTo((698 / 800) * 100, 5)
  })
})

describe("recomendaciones de inventario", () => {
  it("sin filtros muestra los 10 prioritarios, con riesgo en texto y sin origen", async () => {
    await mostrarProyeccion()

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
    expect(screen.getByText("10 prioritarios de 12 productos")).toBeInTheDocument()

    const fila = within(screen.getByRole("table")).getByText("CEM-001").closest("tr")

    expect(fila.querySelector(".badge")).toHaveTextContent("Alto")
    expect(fila).toHaveTextContent("Comprar 196")
    expect(fila).not.toHaveTextContent(/Sistema|Simulado/)
  })

  it("usa los filtros globales y no tiene botones de riesgo propios", async () => {
    await mostrarProyeccion()

    const tabla = document.querySelector(".recomendaciones")

    expect(within(tabla).queryByRole("button", { name: "Alto" })).not.toBeInTheDocument()
    expect(within(tabla).queryByRole("group")).not.toBeInTheDocument()
  })

  it("'Ver todos' muestra el resto sin filtros", async () => {
    await mostrarProyeccion()

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

    await mostrarProyeccion({ datos: proyeccionDePrueba({ productos: [...PRODUCTOS_DE_PRUEBA, ...plomeria] }) })

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
  it("indica que está cargando mientras llega el archivo", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    render(<AnalisisYProyeccion />)

    expect(screen.getByRole("status")).toHaveTextContent("Cargando proyección de demanda…")

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    expect(screen.queryByText("Cargando proyección de demanda…")).not.toBeInTheDocument()
  })

  /*
    Ante cualquier falla, un aviso y nada más: una tarjeta en cero se leería
    como un resultado real.
  */
  it.each([
    ["sin conexión", { falla: new TypeError("Failed to fetch") }],
    ["con el archivo inexistente", { estado: 404 }],
    ["con una estructura incompleta", { datos: proyeccionDePrueba({ productos: [] }) }],
  ])("%s muestra el aviso sin cifras", async (_, opciones) => {
    servirProyeccion(vi, opciones)

    render(<AnalisisYProyeccion />)

    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar la proyección de demanda.")
    expect(document.querySelector(".stat-card")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Análisis y proyección" })).toBeInTheDocument()
  })

  it("con un archivo que no es JSON muestra el mismo aviso", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    })

    render(<AnalisisYProyeccion />)

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_SIN_PROYECCION)
  })

  /*
    Si el usuario sale del Dashboard antes de que llegue el archivo, la
    respuesta tardía no debe intentar actualizar una pantalla que ya no existe.
  */
  it("ignora una respuesta que llega después de salir", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    const { unmount } = render(<AnalisisYProyeccion />)
    unmount()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    await waitFor(() => expect(console.error).not.toHaveBeenCalled())
  })

  it("ignora un error que llega después de salir", async () => {
    let fallar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((_, rechazar) => { fallar = rechazar }))

    const { unmount } = render(<AnalisisYProyeccion />)
    unmount()

    await act(async () => {
      fallar(new TypeError("Failed to fetch"))
    })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
