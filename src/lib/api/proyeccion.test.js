import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { MENSAJE_SIN_PROYECCION, RUTA_PROYECCION, traerProyeccion } from "./proyeccion"
import { proyeccionDePrueba, servirProyeccion } from "../../test/proyeccionDePrueba"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("cargar la proyección", () => {
  it("pide el archivo publicado y devuelve su contenido", async () => {
    const fetch = servirProyeccion(vi)

    const datos = await traerProyeccion()

    expect(fetch).toHaveBeenCalledWith(RUTA_PROYECCION)
    expect(datos.productos).toHaveLength(12)
    expect(datos.resumen.demanda_total_30d).toBe(2470.87)
  })

  it("puede leer otra ruta", async () => {
    const fetch = servirProyeccion(vi)

    await traerProyeccion({ ruta: "/otra.json" })

    expect(fetch).toHaveBeenCalledWith("/otra.json")
  })
})

describe("cuando la proyección no se puede usar", () => {
  it("avisa si no hay conexión", async () => {
    servirProyeccion(vi, { falla: new TypeError("Failed to fetch") })

    const error = await traerProyeccion().catch((e) => e)

    expect(error.message).toBe(MENSAJE_SIN_PROYECCION)
    expect(error.cause).toBeInstanceOf(TypeError)
  })

  it("avisa si el archivo no existe", async () => {
    servirProyeccion(vi, { estado: 404 })

    await expect(traerProyeccion()).rejects.toThrow(MENSAJE_SIN_PROYECCION)
  })

  it("avisa si el archivo no es JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    })

    const error = await traerProyeccion().catch((e) => e)

    expect(error.message).toBe(MENSAJE_SIN_PROYECCION)
    expect(error.cause).toBeInstanceOf(SyntaxError)
  })

  /*
    Un archivo a medio escribir no debe llegar a la pantalla como una tabla
    vacía que parezca "no hay nada que comprar".
  */
  it.each([
    ["sin productos", proyeccionDePrueba({ productos: [] })],
    ["con metadata nula", proyeccionDePrueba({ metadata: null })],
    ["sin resumen", proyeccionDePrueba({ resumen: undefined })],
    ["sin serie mensual", proyeccionDePrueba({ serie_mensual: "no es lista" })],
    ["vacío", null],
  ])("rechaza un archivo %s", async (_, datos) => {
    servirProyeccion(vi, { datos })

    await expect(traerProyeccion()).rejects.toThrow(MENSAJE_SIN_PROYECCION)
  })
})
