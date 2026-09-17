import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import AnaliticaPredictiva from "./AnaliticaPredictiva"
import { MENSAJE_SIN_PROYECCION } from "../lib/api/proyeccion"
import { ORDEN_ESPERADO, PRODUCTOS_DE_PRUEBA, proyeccionDePrueba, servirProyeccion } from "../test/proyeccionDePrueba"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mostrarAnalitica(opciones) {
  servirProyeccion(vi, opciones)
  render(<AnaliticaPredictiva />)

  await screen.findByText("Recomendaciones de inventario")
}

const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest(".stat-card")

const tabla = () => screen.getByRole("table")

const codigosEnLaTabla = () =>
  within(tabla())
    .getAllByRole("row")
    .slice(1)
    .map((fila) => fila.querySelector(".product-cat").textContent)

describe("encabezado", () => {
  it("presenta la página y su propósito", async () => {
    await mostrarAnalitica()

    expect(screen.getByRole("heading", { level: 2, name: "Analítica Predictiva" })).toBeInTheDocument()
    expect(screen.getByText("Pronóstico de demanda y apoyo a decisiones de inventario")).toBeInTheDocument()
  })

  it("indica el período histórico y el proyectado", async () => {
    await mostrarAnalitica()

    expect(screen.getByText("Histórico: enero–agosto 2026 · Proyección: septiembre 2026")).toBeInTheDocument()
  })
})

describe("indicadores", () => {
  it("muestra la demanda a 30 días y, como detalle, la de 7", async () => {
    await mostrarAnalitica()

    const demanda = tarjeta("Demanda 30 días")

    expect(demanda).toHaveTextContent("2,470.9unidades")
    expect(demanda).toHaveTextContent("570.1 unidades / 7 días")
  })

  it("muestra los productos en riesgo alto y qué parte del escenario son", async () => {
    await mostrarAnalitica()

    expect(tarjeta("Riesgo alto")).toHaveTextContent("28productos")
    expect(tarjeta("Riesgo alto")).toHaveTextContent("56% del escenario analizado")
  })

  it("muestra cuántos productos reponer y cuántas unidades", async () => {
    await mostrarAnalitica()

    expect(tarjeta("Reposición")).toHaveTextContent("34productos")
    expect(tarjeta("Reposición")).toHaveTextContent("1,286 unidades recomendadas")
  })

  it("muestra la inversión con el formato de moneda del sistema", async () => {
    await mostrarAnalitica()

    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 119,380.60")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("A costo de compra")
  })

  it("muestra cuántos productos se analizaron y de qué origen", async () => {
    await mostrarAnalitica()

    expect(tarjeta("Productos analizados")).toHaveTextContent("50")
    expect(tarjeta("Productos analizados")).toHaveTextContent("9 sistema · 41 simulados")
  })

  /*
    Las cifras salen del archivo publicado. Si cambian ahí, cambian aquí: no
    hay ningún resultado escrito en la página.
  */
  it("toma las cifras y el porcentaje del archivo, no de valores fijos", async () => {
    const datos = proyeccionDePrueba()
    datos.resumen = { ...datos.resumen, productos_riesgo_alto: 3, inversion_estimada: 1500.5 }
    datos.metadata = { ...datos.metadata, productos: 12, productos_sistema: 3, productos_simulados: 9 }

    await mostrarAnalitica({ datos })

    expect(tarjeta("Riesgo alto")).toHaveTextContent("25% del escenario analizado")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 1,500.50")
    expect(tarjeta("Productos analizados")).toHaveTextContent("3 sistema · 9 simulados")
  })
})

describe("transparencia", () => {
  it("aclara que es un escenario académico con ventas simuladas", async () => {
    await mostrarAnalitica()

    expect(
      screen.getByText(
        "Escenario académico de 50 productos: 9 del sistema y 41 simulados para análisis. " +
          "Las ventas históricas utilizadas para el modelo son simuladas."
      )
    ).toBeInTheDocument()
  })

  it("describe el modelo y cómo se evaluó sin presentarlo como superior", async () => {
    await mostrarAnalitica()

    const nota = screen.getByText(/Modelo de predicción: Random Forest/)

    expect(nota).toHaveTextContent(
      "Entrenado con datos históricos simulados de enero a agosto de 2026 y evaluado mediante " +
        "backtesting temporal contra una media móvil de 28 días."
    )
    expect(document.body).not.toHaveTextContent(/precisión|exactitud|superior|tiempo real|garantizad/i)
  })
})

describe("gráfica de demanda mensual", () => {
  it("muestra ocho meses históricos y septiembre como proyección", async () => {
    await mostrarAnalitica()

    const historicos = document.querySelectorAll('.bar-col[data-tipo="historico"]')
    const proyectados = document.querySelectorAll('.bar-col[data-tipo="proyeccion"]')

    expect(historicos).toHaveLength(8)
    expect(proyectados).toHaveLength(1)
    expect(proyectados[0]).toHaveTextContent("sep")
  })

  /*
    La proyección no puede leerse como un dato observado: además del estilo
    distinto, lo dice en el texto.
  */
  it("marca septiembre como proyección en el texto, no solo en el color", async () => {
    await mostrarAnalitica()

    const septiembre = document.querySelector('.bar-col[data-tipo="proyeccion"]')

    expect(septiembre).toHaveTextContent("proy.")
    expect(within(septiembre).getByRole("img")).toHaveAccessibleName(/sep: 2,471 unidades \(proyección\)/)
    expect(septiembre.querySelector(".bar")).toHaveClass("secondary")
  })

  it("rotula los meses históricos como datos, sin la marca de proyección", async () => {
    await mostrarAnalitica()

    const agosto = screen.getByRole("img", { name: "ago: 2,470 unidades" })
    const columna = agosto.closest(".bar-col")

    expect(columna).toHaveAttribute("data-tipo", "historico")
    expect(columna).not.toHaveTextContent("proy.")
    expect(agosto).not.toHaveClass("secondary")
  })

  it("rotula en la leyenda qué es histórico y qué es proyección", async () => {
    await mostrarAnalitica()

    const leyenda = document.querySelector(".proyeccion-leyenda")

    expect(leyenda).toHaveTextContent("Histórico")
    expect(leyenda).toHaveTextContent("Proyección")
  })
})

describe("eje de la gráfica mensual", () => {
  it("marca una escala redonda desde cero que cubre el mes más alto", async () => {
    await mostrarAnalitica()

    const marcas = [...document.querySelectorAll(".grafica-eje span")].map((marca) => marca.textContent)

    expect(marcas).toEqual(["0", "1,000", "2,000", "3,000"])
    expect(document.querySelector(".grafica-eje")).toHaveAttribute("aria-hidden", "true")
  })

  it("mide cada barra contra el tope del eje", async () => {
    await mostrarAnalitica()

    const marzo = screen.getByRole("img", { name: "mar: 2,856 unidades" })

    expect(parseFloat(marzo.style.height)).toBeCloseTo((2856 / 3000) * 100, 5)
  })
})

describe("distribución de riesgo", () => {
  const dona = () => document.querySelector(".distribucion-riesgo")

  it("resume en texto los tres niveles y el total", async () => {
    await mostrarAnalitica()

    expect(within(dona()).getByRole("img")).toHaveAccessibleName(
      "50 productos por nivel de riesgo. Alto: 28 (56%), Medio: 6 (12%), Bajo: 16 (32%)."
    )
  })

  it("muestra en la leyenda cantidad y porcentaje de cada riesgo, y el total que suman", async () => {
    await mostrarAnalitica()

    const filas = within(dona()).getAllByRole("listitem")

    expect(filas.map((fila) => fila.textContent)).toEqual(["Alto2856%", "Medio612%", "Bajo1632%", "Total50"])
    expect(dona().querySelector(".dona-centro")).toHaveTextContent("50productos")
  })

  it("dibuja un arco por riesgo, proporcional a su cantidad", async () => {
    await mostrarAnalitica()

    const largo = (riesgo) =>
      parseFloat(dona().querySelector(`circle[data-riesgo="${riesgo}"]`).getAttribute("stroke-dasharray"))

    expect(largo("alto")).toBeCloseTo(56 - 0.8, 5)
    expect(largo("medio")).toBeCloseTo(12 - 0.8, 5)
    expect(largo("bajo")).toBeCloseTo(32 - 0.8, 5)
  })

  it("toma los conteos del resumen del archivo", async () => {
    const datos = proyeccionDePrueba()
    datos.resumen = { ...datos.resumen, productos_riesgo_alto: 3, productos_riesgo_medio: 1, productos_riesgo_bajo: 1 }

    await mostrarAnalitica({ datos })

    expect(within(dona()).getAllByRole("listitem").map((fila) => fila.textContent)).toEqual([
      "Alto360%", "Medio120%", "Bajo120%", "Total5",
    ])
  })
})

describe("top 10 demanda proyectada", () => {
  const ranking = () => screen.getByRole("list", { name: "Top 10 demanda proyectada — 30 días" })

  it("lista los 10 productos con más demanda predicha a 30 días, de mayor a menor", async () => {
    await mostrarAnalitica()

    const filas = within(ranking()).getAllByRole("listitem")

    expect(filas).toHaveLength(10)
    expect(filas.map((fila) => fila.querySelector(".barra-h-detalle").textContent)).toEqual([
      "CEM-001", "FER-020", "TOR-001", "FER-022", "FER-021",
      "FER-041", "CER-023", "FER-040", "FER-043", "FER-042",
    ])
    expect(filas[0]).toHaveTextContent("Cemento gris 42.5 kg")
    expect(filas[0]).toHaveTextContent("205.7 u.")
  })

  it("dibuja la barra más larga para el primero, sin exponerla a lectores de pantalla", async () => {
    await mostrarAnalitica()

    const [primera, segunda] = within(ranking()).getAllByRole("listitem")

    expect(primera.querySelector(".barra-h-relleno").style.width).toBe("100%")
    expect(parseFloat(segunda.querySelector(".barra-h-relleno").style.width)).toBeCloseTo((180 / 205.74) * 100, 5)
    expect(primera.querySelector(".barra-h-pista")).toHaveAttribute("aria-hidden", "true")
  })
})

describe("inversión recomendada por categoría", () => {
  const grafica = () => screen.getByRole("list", { name: "Inversión recomendada por categoría" }).closest(".chart-wrap")

  it("agrupa por categoría, de mayor a menor inversión, en lempiras", async () => {
    await mostrarAnalitica()

    const filas = within(grafica()).getAllByRole("listitem")

    expect(filas.map((fila) => fila.querySelector(".barra-h-nombre").firstChild.textContent)).toEqual([
      "Construcción", "Herramientas Eléctricas", "Tornillería", "Plomería", "Jardinería",
    ])
    expect(filas[0]).toHaveTextContent("3 productos")
    expect(filas[0]).toHaveTextContent("L 39,008.00")
    expect(filas[4]).toHaveTextContent("1 producto")
    expect(filas[4]).toHaveTextContent("L 150.00")
  })

  it("cierra con el total, que es la suma de las categorías", async () => {
    await mostrarAnalitica()

    expect(grafica().querySelector(".barras-h-pie")).toHaveTextContent("TotalL 69,458.00")
  })
})

describe("recomendaciones de inventario", () => {
  it("muestra por omisión solo los 10 productos prioritarios, en orden", async () => {
    await mostrarAnalitica()

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
    expect(screen.getByText("10 prioritarios de 12 productos")).toBeInTheDocument()
  })

  it("muestra el riesgo con texto, no solo con color", async () => {
    await mostrarAnalitica()

    const filas = within(tabla()).getAllByRole("row").slice(1)
    const riesgoDe = (i) => filas[i].querySelector(".badge")

    expect(riesgoDe(0)).toHaveTextContent("Alto")
    expect(riesgoDe(0)).toHaveClass("badge-out")
    expect(riesgoDe(6)).toHaveTextContent("Medio")
    expect(riesgoDe(6)).toHaveClass("badge-low")
    expect(riesgoDe(8)).toHaveTextContent("Bajo")
    expect(riesgoDe(8)).toHaveClass("badge-ok")
  })

  it("distingue los productos simulados de los del sistema", async () => {
    await mostrarAnalitica()

    const filaDe = (codigo) => within(tabla()).getByText(codigo).closest("tr")

    expect(within(filaDe("CEM-001")).getByText("Sistema")).toBeInTheDocument()
    expect(within(filaDe("FER-020")).getByText("Simulado")).toBeInTheDocument()
    expect(within(filaDe("FER-020")).queryByText("Sistema")).not.toBeInTheDocument()
  })

  it("dice cuánto comprar, o que no hace falta", async () => {
    await mostrarAnalitica()

    const filaDe = (codigo) => within(tabla()).getByText(codigo).closest("tr")

    expect(filaDe("CEM-001")).toHaveTextContent("Comprar 196")
    expect(filaDe("CER-023")).toHaveTextContent("Sin compra")
  })

  it("muestra stock y demanda con formato de cantidades", async () => {
    await mostrarAnalitica()

    const celdas = within(within(tabla()).getByText("CEM-001").closest("tr")).getAllByRole("cell")

    expect(celdas[2]).toHaveTextContent("60")
    expect(celdas[3]).toHaveTextContent("45.0")
    expect(celdas[4]).toHaveTextContent("205.7")
  })

  it("'Ver todos' muestra el resto y se puede volver a los prioritarios", async () => {
    await mostrarAnalitica()

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (12)" }))

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO)
    expect(screen.getByText("Mostrando 12 de 12 productos")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver solo los 10 prioritarios" }))

    expect(codigosEnLaTabla()).toHaveLength(10)
  })

  it("filtra por riesgo y marca el filtro activo", async () => {
    await mostrarAnalitica()

    fireEvent.click(screen.getByRole("button", { name: "Medio" }))

    expect(codigosEnLaTabla()).toEqual(["FER-031", "FER-030"])
    expect(screen.getByRole("button", { name: "Medio" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false")
  })

  it("con pocos productos filtrados no ofrece 'Ver todos'", async () => {
    await mostrarAnalitica()

    fireEvent.click(screen.getByRole("button", { name: "Bajo" }))

    expect(codigosEnLaTabla()).toEqual(["FER-041", "CER-023", "FER-040", "FER-043"])
    expect(screen.getByText("Mostrando 4 de 4 productos")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Ver todos/ })).not.toBeInTheDocument()
  })

  /*
    Con un filtro, los diez primeros no son "los prioritarios" del
    inventario: el conteo lo dice de forma neutra.
  */
  it("con un filtro que deja más de diez, cuenta sin llamarlos prioritarios", async () => {
    const muchosEnRiesgoBajo = Array.from({ length: 16 }, (_, i) => ({
      ...PRODUCTOS_DE_PRUEBA[0],
      producto_id: `bajo-${i}`,
      codigo: `BAJ-${String(i).padStart(3, "0")}`,
      riesgo: "bajo",
      recomendacion_compra: 0,
    }))

    await mostrarAnalitica({ datos: proyeccionDePrueba({ productos: muchosEnRiesgoBajo }) })

    fireEvent.click(screen.getByRole("button", { name: "Bajo" }))

    expect(screen.getByText("Mostrando 10 de 16 productos")).toBeInTheDocument()
    expect(screen.queryByText(/prioritarios/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (16)" }))

    expect(screen.getByText("Mostrando 16 de 16 productos")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ver solo 10" })).toBeInTheDocument()
  })

  it("vuelve a mostrar todos los riesgos con 'Todos'", async () => {
    await mostrarAnalitica()

    fireEvent.click(screen.getByRole("button", { name: "Alto" }))
    expect(codigosEnLaTabla()).toHaveLength(6)

    fireEvent.click(screen.getByRole("button", { name: "Todos" }))
    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
  })

  it("avisa cuando ningún producto tiene el riesgo elegido", async () => {
    const datos = proyeccionDePrueba({
      productos: PRODUCTOS_DE_PRUEBA.filter((p) => p.riesgo !== "medio"),
    })

    await mostrarAnalitica({ datos })

    fireEvent.click(screen.getByRole("button", { name: "Medio" }))

    expect(screen.getByText("Ningún producto con ese nivel de riesgo")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})

describe("carga de la información", () => {
  it("indica que está cargando mientras llega el archivo", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    render(<AnaliticaPredictiva />)

    expect(screen.getByRole("status")).toHaveTextContent("Cargando Analítica Predictiva…")

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
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

    render(<AnaliticaPredictiva />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No fue posible cargar la información de Analítica Predictiva."
    )
    expect(document.querySelector(".stat-card")).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Analítica Predictiva" })).toBeInTheDocument()
  })

  it("con un archivo que no es JSON muestra el mismo aviso", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    })

    render(<AnaliticaPredictiva />)

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_SIN_PROYECCION)
    expect(document.querySelector(".stat-card")).not.toBeInTheDocument()
  })

  /*
    Si el usuario sale de la página antes de que llegue el archivo, la
    respuesta tardía no debe intentar actualizar una pantalla que ya no existe.
  */
  it("ignora una respuesta que llega después de salir de la página", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    const { unmount } = render(<AnaliticaPredictiva />)
    unmount()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    await waitFor(() => expect(console.error).not.toHaveBeenCalled())
  })

  it("ignora un error que llega después de salir de la página", async () => {
    let fallar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((_, rechazar) => { fallar = rechazar }))

    const { unmount } = render(<AnaliticaPredictiva />)
    unmount()

    await act(async () => {
      fallar(new TypeError("Failed to fetch"))
    })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
