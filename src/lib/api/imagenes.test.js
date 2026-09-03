import { describe, it, expect } from "vitest"

import {
  revisarImagen,
  FORMATOS_DE_IMAGEN,
  TAMANO_MAXIMO_IMAGEN,
} from "./catalogos"

const archivo = ({ type = "image/jpeg", size = 1024 } = {}) => ({ type, size })

describe("revisarImagen", () => {
  it("acepta los formatos que admite el bucket", () => {
    FORMATOS_DE_IMAGEN.forEach((type) => {
      expect(() => revisarImagen(archivo({ type }))).not.toThrow()
    })
  })

  it("rechaza un formato que no es imagen", () => {
    expect(() => revisarImagen(archivo({ type: "application/pdf" }))).toThrow(
      /JPG, PNG o WebP/i
    )
  })

  it("rechaza un formato de imagen que el bucket no acepta", () => {
    expect(() => revisarImagen(archivo({ type: "image/gif" }))).toThrow(
      /JPG, PNG o WebP/i
    )
  })

  it("acepta una imagen justo en el límite de tamaño", () => {
    expect(() =>
      revisarImagen(archivo({ size: TAMANO_MAXIMO_IMAGEN }))
    ).not.toThrow()
  })

  it("rechaza una imagen que pasa el límite", () => {
    expect(() =>
      revisarImagen(archivo({ size: TAMANO_MAXIMO_IMAGEN + 1 }))
    ).toThrow(/máximo es 2 MB/i)
  })

  it("dice cuánto pesaba la imagen rechazada", () => {
    expect(() => revisarImagen(archivo({ size: 5 * 1024 * 1024 }))).toThrow(
      /5\.0 MB/
    )
  })
})
