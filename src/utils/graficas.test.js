import { describe, it, expect } from "vitest"

import { arcosDeDona, escalaDeEje, largoDeBarra } from "./graficas"

describe("largo de las barras", () => {
  it("es proporcional al máximo", () => {
    expect(largoDeBarra(50, 100)).toBe(50)
    expect(largoDeBarra(100, 100)).toBe(100)
  })

  it("nunca baja de 4% para que un valor pequeño siga viéndose", () => {
    expect(largoDeBarra(0, 100)).toBe(4)
    expect(largoDeBarra(1, 1000)).toBe(4)
  })

  it("no pasa de 100% ni divide por cero", () => {
    expect(largoDeBarra(200, 100)).toBe(100)
    expect(largoDeBarra(10, 0)).toBe(4)
  })
})

describe("escala del eje", () => {
  it("termina en un número redondo por encima del máximo", () => {
    expect(escalaDeEje(2856)).toEqual({ tope: 3000, marcas: [0, 1000, 2000, 3000] })
  })

  it("elige pasos de 2, 2.5 o 5 cuando convienen", () => {
    expect(escalaDeEje(7).marcas).toEqual([0, 2, 4, 6, 8])
    expect(escalaDeEje(9).marcas).toEqual([0, 2.5, 5, 7.5, 10])
    expect(escalaDeEje(180).marcas).toEqual([0, 50, 100, 150, 200])
  })

  it("con un máximo exacto no agrega una marca de más", () => {
    expect(escalaDeEje(4000).tope).toBe(4000)
  })

  it("sin datos devuelve una escala mínima válida", () => {
    expect(escalaDeEje(0)).toEqual({ tope: 1, marcas: [0, 1] })
  })
})

describe("arcos de la dona", () => {
  const segmentos = [
    { riesgo: "alto", cantidad: 28 },
    { riesgo: "medio", cantidad: 6 },
    { riesgo: "bajo", cantidad: 16 },
  ]

  it("reparte la circunferencia según la cantidad, dejando un hueco entre segmentos", () => {
    const arcos = arcosDeDona(segmentos, 1)
    const esperados = [
      { riesgo: "alto", inicio: 0.5, largo: 55 },
      { riesgo: "medio", inicio: 56.5, largo: 11 },
      { riesgo: "bajo", inicio: 68.5, largo: 31 },
    ]

    esperados.forEach((esperado, i) => {
      expect(arcos[i].riesgo).toBe(esperado.riesgo)
      expect(arcos[i].inicio).toBeCloseTo(esperado.inicio, 9)
      expect(arcos[i].largo).toBeCloseTo(esperado.largo, 9)
    })
  })

  it("con un solo segmento dibuja el anillo completo", () => {
    const [alto, medio] = arcosDeDona([{ cantidad: 5 }, { cantidad: 0 }])

    expect(alto).toMatchObject({ inicio: 0, largo: 100 })
    expect(medio.largo).toBe(0)
  })

  it("sin cantidades no dibuja nada", () => {
    expect(arcosDeDona([{ cantidad: 0 }]).map((arco) => arco.largo)).toEqual([0])
  })
})
