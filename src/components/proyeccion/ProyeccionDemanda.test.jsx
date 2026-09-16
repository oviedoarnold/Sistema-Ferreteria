import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import ProyeccionDemanda from "./ProyeccionDemanda"
import { ORDEN_ESPERADO, PRODUCTOS_DE_PRUEBA, proyeccionDePrueba, servirProyeccion } from "../../test/proyeccionDePrueba"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mostrarProyeccion(opciones) {
  servirProyeccion(vi, opciones)
  render(<ProyeccionDemanda />)

  await screen.findByText("Recomendaciones de inventario")
}

const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest(".stat-card")

const tabla = () => screen.getByRole("table")

const codigosEnLaTabla = () =>
  within(tabla())
    .getAllByRole("row")
    .slice(1)
    .map((fila) => fila.querySelector(".product-cat").textContent)

describe("indicadores de la proyección", () => {
  it("muestra la demanda proyectada a 30 días y, al lado, la de 7", async () => {
    await mostrarProyeccion()

    const demanda = tarjeta("Demanda proyectada 30 días")

    expect(demanda).toHaveTextContent("2,470.9")
    expect(demanda).toHaveTextContent("7 días: 570.1")
  })

  it("muestra cuántos productos están en riesgo alto, sobre el total", async () => {
    await mostrarProyeccion()

    expect(tarjeta("Productos en riesgo alto")).toHaveTextContent("28")
    expect(tarjeta("Productos en riesgo alto")).toHaveTextContent("de 50 productos")
  })

  it("muestra cuántos productos necesitan reposición y cuántas unidades", async () => {
    await mostrarProyeccion()

    expect(tarjeta("Con reposición recomendada")).toHaveTextContent("34")
    expect(tarjeta("Con reposición recomendada")).toHaveTextContent("1,286 unidades")
  })

  it("muestra la inversión con el formato de moneda del sistema", async () => {
    await mostrarProyeccion()

    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 119,380.60")
  })

  /*
    Las cifras salen del archivo publicado. Si cambian ahí, cambian aquí: no
    hay ningún número escrito en el componente.
  */
  it("toma las cifras del archivo y no de valores fijos", async () => {
    const datos = proyeccionDePrueba()
    datos.resumen = { ...datos.resumen, productos_riesgo_alto: 3, inversion_estimada: 1500.5 }

    await mostrarProyeccion({ datos })

    expect(tarjeta("Productos en riesgo alto")).toHaveTextContent("3")
    expect(tarjeta("Inversión estimada")).toHaveTextContent("L 1,500.50")
  })
})

describe("transparencia", () => {
  it("aclara que es un escenario académico con productos simulados", async () => {
    await mostrarProyeccion()

    expect(
      screen.getByText(/escenario académico de 50 productos: 9 del sistema y 41 simulados/i)
    ).toBeInTheDocument()
  })

  it("indica el período de los datos históricos", async () => {
    await mostrarProyeccion()

    expect(screen.getByText(/Datos históricos: enero–agosto 2026/)).toBeInTheDocument()
  })

  it("nombra el modelo y la referencia sin presentarlo como superior", async () => {
    await mostrarProyeccion()

    const nota = screen.getByText(/Modelo de predicción: Random Forest/)

    expect(nota).toHaveTextContent("datos históricos simulados")
    expect(nota).toHaveTextContent("media móvil de 28 días como referencia")
    expect(nota).not.toHaveTextContent(/precisión|exact|superior|tiempo real/i)
  })
})

describe("gráfica de demanda mensual", () => {
  it("muestra ocho meses históricos y septiembre como proyección", async () => {
    await mostrarProyeccion()

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
    await mostrarProyeccion()

    const septiembre = document.querySelector('.bar-col[data-tipo="proyeccion"]')

    expect(septiembre).toHaveTextContent("proy.")
    expect(within(septiembre).getByRole("img")).toHaveAccessibleName(/sep: 2,471 unidades \(proyección\)/)
    expect(septiembre.querySelector(".bar")).toHaveClass("secondary")
  })

  it("rotula los meses históricos como datos, sin la marca de proyección", async () => {
    await mostrarProyeccion()

    const agosto = screen.getByRole("img", { name: "ago: 2,470 unidades" })
    const columna = agosto.closest(".bar-col")

    expect(columna).toHaveAttribute("data-tipo", "historico")
    expect(columna).not.toHaveTextContent("proy.")
    expect(agosto).not.toHaveClass("secondary")
  })

  it("rotula en la leyenda qué es histórico y qué es proyección", async () => {
    await mostrarProyeccion()

    const leyenda = document.querySelector(".proyeccion-leyenda")

    expect(leyenda).toHaveTextContent("Histórico")
    expect(leyenda).toHaveTextContent("Proyección")
  })
})

describe("recomendaciones de inventario", () => {
  it("muestra por omisión solo los 10 productos prioritarios, en orden", async () => {
    await mostrarProyeccion()

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
    expect(screen.getByText("10 prioritarios de 12")).toBeInTheDocument()
  })

  it("muestra el riesgo con texto, no solo con color", async () => {
    await mostrarProyeccion()

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
    await mostrarProyeccion()

    const filaDe = (codigo) => screen.getByText(codigo).closest("tr")

    expect(within(filaDe("CEM-001")).getByText("Sistema")).toBeInTheDocument()
    expect(within(filaDe("FER-020")).getByText("Simulado")).toBeInTheDocument()
    expect(within(filaDe("FER-020")).queryByText("Sistema")).not.toBeInTheDocument()
  })

  it("dice cuánto comprar, o que no hace falta", async () => {
    await mostrarProyeccion()

    const filaDe = (codigo) => screen.getByText(codigo).closest("tr")

    expect(filaDe("CEM-001")).toHaveTextContent("Comprar 196")
    expect(filaDe("CER-023")).toHaveTextContent("Sin compra")
  })

  it("muestra stock y demanda con formato de cantidades", async () => {
    await mostrarProyeccion()

    const celdas = within(screen.getByText("CEM-001").closest("tr")).getAllByRole("cell")

    expect(celdas[2]).toHaveTextContent("60")
    expect(celdas[3]).toHaveTextContent("45.0")
    expect(celdas[4]).toHaveTextContent("205.7")
  })

  it("'Ver todos' muestra el resto y se puede volver a los prioritarios", async () => {
    await mostrarProyeccion()

    fireEvent.click(screen.getByRole("button", { name: "Ver todos (12)" }))

    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO)
    expect(screen.getByText("12 productos")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver solo los 10 prioritarios" }))

    expect(codigosEnLaTabla()).toHaveLength(10)
  })

  it("filtra por riesgo y marca el filtro activo", async () => {
    await mostrarProyeccion()

    fireEvent.click(screen.getByRole("button", { name: "Medio" }))

    expect(codigosEnLaTabla()).toEqual(["FER-031", "FER-030"])
    expect(screen.getByRole("button", { name: "Medio" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false")
  })

  it("con pocos productos filtrados no ofrece 'Ver todos'", async () => {
    await mostrarProyeccion()

    fireEvent.click(screen.getByRole("button", { name: "Bajo" }))

    expect(codigosEnLaTabla()).toEqual(["FER-041", "CER-023", "FER-040", "FER-043"])
    expect(screen.getByText("4 productos")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Ver todos/ })).not.toBeInTheDocument()
  })

  it("vuelve a mostrar todos los riesgos con 'Todos'", async () => {
    await mostrarProyeccion()

    fireEvent.click(screen.getByRole("button", { name: "Alto" }))
    expect(codigosEnLaTabla()).toHaveLength(6)

    fireEvent.click(screen.getByRole("button", { name: "Todos" }))
    expect(codigosEnLaTabla()).toEqual(ORDEN_ESPERADO.slice(0, 10))
  })

  it("avisa cuando ningún producto tiene el riesgo elegido", async () => {
    const datos = proyeccionDePrueba({
      productos: PRODUCTOS_DE_PRUEBA.filter((p) => p.riesgo !== "medio"),
    })

    await mostrarProyeccion({ datos })

    fireEvent.click(screen.getByRole("button", { name: "Medio" }))

    expect(screen.getByText("Ningún producto con ese nivel de riesgo")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})

describe("carga de la proyección", () => {
  it("indica que está cargando mientras llega el archivo", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    render(<ProyeccionDemanda />)

    expect(screen.getByText("Cargando proyección…")).toBeInTheDocument()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    expect(screen.queryByText("Cargando proyección…")).not.toBeInTheDocument()
  })

  it("si falla, lo dice sin mostrar cifras vacías", async () => {
    servirProyeccion(vi, { estado: 404 })

    render(<ProyeccionDemanda />)

    expect(await screen.findByText("No fue posible cargar la proyección de demanda.")).toBeInTheDocument()
    expect(screen.queryByText("Productos en riesgo alto")).not.toBeInTheDocument()
    expect(screen.queryByText("Cargando proyección…")).not.toBeInTheDocument()
    expect(screen.getByText("Proyección de demanda e inventario")).toBeInTheDocument()
  })

  /*
    Si el Dashboard se desmonta antes de que llegue el archivo, la respuesta
    tardía no debe intentar actualizar una pantalla que ya no existe.
  */
  it("ignora una respuesta que llega después de salir de la pantalla", async () => {
    let entregar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolver) => { entregar = resolver }))

    const { unmount } = render(<ProyeccionDemanda />)
    unmount()

    await act(async () => {
      entregar({ ok: true, status: 200, json: () => Promise.resolve(proyeccionDePrueba()) })
    })

    await waitFor(() => expect(console.error).not.toHaveBeenCalled())
  })

  it("ignora un error que llega después de salir de la pantalla", async () => {
    let fallar
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((_, rechazar) => { fallar = rechazar }))

    const { unmount } = render(<ProyeccionDemanda />)
    unmount()

    await act(async () => {
      fallar(new TypeError("Failed to fetch"))
    })

    expect(screen.queryByText("No fue posible cargar la proyección de demanda.")).not.toBeInTheDocument()
  })
})
