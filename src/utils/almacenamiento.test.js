import { describe, it, expect, vi, afterEach } from "vitest"

import {
  guardarJSON,
  leerJSON,
  guardarTexto,
  leerTexto,
  borrar,
} from "./almacenamiento"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("guardarJSON", () => {
  it("guarda y recupera un objeto", () => {
    guardarJSON("prueba", { nombre: "Ferremax", total: 207 })

    expect(leerJSON("prueba")).toEqual({ nombre: "Ferremax", total: 207 })
  })

  it("conserva acentos y eñes", () => {
    guardarJSON("prueba", { categoria: "Construcción", nota: "ñandú" })

    expect(leerJSON("prueba").categoria).toBe("Construcción")
    expect(leerJSON("prueba").nota).toBe("ñandú")
  })

  it("quita los caracteres de control del texto", () => {
    guardarJSON("prueba", { nombre: "Ferre\u0000max\u001f" })

    expect(leerJSON("prueba").nombre).toBe("Ferremax")
  })

  it("limpia dentro de listas anidadas", () => {
    guardarJSON("prueba", {
      items: [{ nombre: "Cemento\u0007" }, { nombre: "Martillo" }],
    })

    expect(leerJSON("prueba").items[0].nombre).toBe("Cemento")
  })

  it("recorta los textos demasiado largos", () => {
    guardarJSON("prueba", { nombre: "x".repeat(5000) })

    expect(leerJSON("prueba").nombre).toHaveLength(2000)
  })

  it("no altera los números ni los booleanos", () => {
    guardarJSON("prueba", { precio: 180.5, activo: true, sin: null })

    expect(leerJSON("prueba")).toEqual({
      precio: 180.5,
      activo: true,
      sin: null,
    })
  })

  it("devuelve false si el almacenamiento falla", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(guardarJSON("prueba", { a: 1 })).toBe(false)
  })
})

describe("leerJSON", () => {
  it("devuelve el valor por defecto cuando la clave no existe", () => {
    expect(leerJSON("inexistente", [])).toEqual([])
  })

  it("devuelve el valor por defecto ante datos corruptos", () => {
    localStorage.setItem("rota", "{esto no es json")
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(leerJSON("rota", "respaldo")).toBe("respaldo")
  })
})

describe("guardarTexto y leerTexto", () => {
  it("guarda una cadena sin envolverla en JSON", () => {
    guardarTexto("sesion", "admin-inicial")

    expect(localStorage.getItem("sesion")).toBe("admin-inicial")
    expect(leerTexto("sesion")).toBe("admin-inicial")
  })

  it("convierte valores que no son cadena", () => {
    guardarTexto("numero", 42)

    expect(leerTexto("numero")).toBe("42")
  })

  it("guarda cadena vacía si el valor es nulo", () => {
    guardarTexto("vacio", null)

    expect(leerTexto("vacio")).toBe("")
  })

  it("devuelve el valor por defecto si no existe", () => {
    expect(leerTexto("nada", "defecto")).toBe("defecto")
  })
})

describe("borrar", () => {
  it("elimina la clave", () => {
    guardarTexto("temporal", "algo")
    borrar("temporal")

    expect(leerTexto("temporal")).toBeNull()
  })

  it("devuelve true aunque la clave no exista", () => {
    expect(borrar("nunca-existio")).toBe(true)
  })
})
