import { describe, it, expect } from "vitest"

import {
  roundMoney,
  isCreditSale,
  getSalePayments,
  getSalePaid,
  getSaleBalance,
  applyPayments,
  totalesDeVentasPorMes,
} from "./salesUtils"

const credito = (total, payments = []) => ({
  id: "F-1",
  total,
  paymentType: "credito",
  status: "pendiente",
  payments,
})

const abono = (amount, id = `AB-${amount}-${Math.random()}`) => ({
  id,
  amount,
})

describe("roundMoney", () => {
  it("corrige el error clásico de punto flotante", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })

  it("redondea a dos decimales", () => {
    expect(roundMoney(10.005)).toBe(10.01)
    expect(roundMoney(10.004)).toBe(10)
  })

  it("trata los valores ausentes como cero", () => {
    expect(roundMoney(null)).toBe(0)
    expect(roundMoney(undefined)).toBe(0)
    expect(roundMoney("")).toBe(0)
  })
})

describe("isCreditSale", () => {
  it("reconoce una venta a crédito", () => {
    expect(isCreditSale({ paymentType: "credito" })).toBe(true)
  })

  it("no confunde una venta de contado", () => {
    expect(isCreditSale({ paymentType: "contado" })).toBe(false)
  })

  it("acepta el campo type como respaldo", () => {
    expect(isCreditSale({ type: "credito" })).toBe(true)
  })

  it("no distingue mayúsculas", () => {
    expect(isCreditSale({ paymentType: "CREDITO" })).toBe(true)
  })

  it("asume contado cuando no hay dato", () => {
    expect(isCreditSale({})).toBe(false)
    expect(isCreditSale(null)).toBe(false)
  })
})

describe("getSalePayments", () => {
  it("devuelve una lista vacía en facturas anteriores a los abonos", () => {
    expect(getSalePayments({ total: 100 })).toEqual([])
  })

  it("ignora un campo payments corrupto", () => {
    expect(getSalePayments({ payments: "no es lista" })).toEqual([])
  })
})

describe("getSalePaid", () => {
  it("suma los abonos registrados", () => {
    expect(getSalePaid(credito(1000, [abono(300), abono(250)]))).toBe(550)
  })

  it("devuelve cero sin abonos", () => {
    expect(getSalePaid(credito(1000))).toBe(0)
  })
})

describe("getSaleBalance", () => {
  it("una venta de contado nunca arrastra saldo", () => {
    expect(getSaleBalance({ total: 500, paymentType: "contado" })).toBe(0)
  })

  it("una venta a crédito sin abonos debe el total", () => {
    expect(getSaleBalance(credito(1000))).toBe(1000)
  })

  it("descuenta los abonos parciales", () => {
    expect(getSaleBalance(credito(1000, [abono(400)]))).toBe(600)
  })

  it("nunca devuelve un saldo negativo", () => {
    expect(getSaleBalance(credito(100, [abono(150)]))).toBe(0)
  })

  it("funciona con facturas guardadas antes de existir los abonos", () => {
    expect(getSaleBalance({ total: 300, paymentType: "credito" })).toBe(300)
  })

  it("cierra en cero exacto pagando en tercios con centavos", () => {
    const venta = credito(1035.75, [
      abono(345.25, "a"),
      abono(345.25, "b"),
      abono(345.25, "c"),
    ])

    expect(getSaleBalance(venta)).toBe(0)
  })
})

describe("applyPayments", () => {
  it("mantiene pendiente mientras quede saldo", () => {
    expect(applyPayments(credito(1000), [abono(400)]).status).toBe("pendiente")
  })

  it("pasa a pagada al cubrir el total de una sola vez", () => {
    expect(applyPayments(credito(1000), [abono(1000)]).status).toBe("pagada")
  })

  it("pasa a pagada al cubrir el total por partes", () => {
    const resultado = applyPayments(credito(1000), [abono(600), abono(400)])
    expect(resultado.status).toBe("pagada")
  })

  it("vuelve a pendiente si se elimina un abono", () => {
    const saldada = credito(1000, [abono(600, "x"), abono(400, "y")])
    const resultado = applyPayments(saldada, [abono(600, "x")])

    expect(resultado.status).toBe("pendiente")
  })

  it("vuelve a pendiente si se eliminan todos los abonos", () => {
    const saldada = credito(1000, [abono(1000)])
    expect(applyPayments(saldada, []).status).toBe("pendiente")
  })

  it("no muta la venta original", () => {
    const original = credito(1000, [abono(200)])
    const copia = JSON.stringify(original)

    applyPayments(original, [...original.payments, abono(300)])

    expect(JSON.stringify(original)).toBe(copia)
  })

  it("deja la lista de abonos que se le pasó", () => {
    const nuevos = [abono(100), abono(200)]
    expect(applyPayments(credito(1000), nuevos).payments).toEqual(nuevos)
  })
})

describe("totales de ventas por mes", () => {
  const vendida = (anio, mes, dia, total) => ({ timestamp: new Date(anio, mes, dia, 10).getTime(), total })

  it("devuelve los últimos seis meses, del más antiguo al actual", () => {
    const meses = totalesDeVentasPorMes([], { hoy: new Date(2026, 8, 16) })

    expect(meses.map((mes) => mes.clave)).toEqual(["2026-4", "2026-5", "2026-6", "2026-7", "2026-8", "2026-9"])
    expect(meses.map((mes) => mes.etiqueta)).toEqual(["abr", "may", "jun", "jul", "ago", "sept"])
  })

  it("suma cada venta en su mes", () => {
    const ventas = [vendida(2026, 8, 1, 100), vendida(2026, 8, 15, 50.5), vendida(2026, 7, 31, 30)]

    const meses = totalesDeVentasPorMes(ventas, { hoy: new Date(2026, 8, 16) })

    expect(meses.at(-1).total).toBe(150.5)
    expect(meses.at(-2).total).toBe(30)
    expect(meses[0].total).toBe(0)
  })

  it("no salta febrero cuando hoy es día 31", () => {
    const meses = totalesDeVentasPorMes([vendida(2026, 1, 10, 80)], { hoy: new Date(2026, 2, 31) })

    expect(meses.map((mes) => mes.clave)).toEqual(["2025-10", "2025-11", "2025-12", "2026-1", "2026-2", "2026-3"])
    expect(meses.at(-2).total).toBe(80)
  })

  it("ignora las ventas sin fecha válida y las de otros años", () => {
    const ventas = [{ timestamp: "no es fecha", total: 999 }, vendida(2025, 8, 10, 500)]

    const meses = totalesDeVentasPorMes(ventas, { hoy: new Date(2026, 8, 16) })

    expect(meses.every((mes) => mes.total === 0)).toBe(true)
  })
})
