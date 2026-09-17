import { describe, it, expect } from "vitest"

import { alturaDeBarra } from "./graficas"

describe("altura de las barras", () => {
  it("es proporcional al máximo", () => {
    expect(alturaDeBarra(50, 100)).toBe(50)
    expect(alturaDeBarra(100, 100)).toBe(100)
  })

  it("nunca baja de 4% para que un valor pequeño siga viéndose", () => {
    expect(alturaDeBarra(0, 100)).toBe(4)
    expect(alturaDeBarra(1, 1000)).toBe(4)
  })

  it("no pasa de 100% ni divide por cero", () => {
    expect(alturaDeBarra(200, 100)).toBe(100)
    expect(alturaDeBarra(10, 0)).toBe(4)
  })
})
