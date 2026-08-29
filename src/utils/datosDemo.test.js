import { describe, it, expect } from "vitest"

import {
  sembrarDatosDemo,
  CREDENCIALES_DEMO,
  CREDENCIALES_DEMO_ADMIN,
} from "./datosDemo"

import { hashPassword } from "./password"
import { leerJSON } from "./almacenamiento"
import { getSaleBalance } from "./salesUtils"
import { getQuoteStatus } from "./quotes"

describe("sembrarDatosDemo", () => {
  it("informa cuánto cargó", () => {
    const resumen = sembrarDatosDemo()

    expect(resumen).toEqual({
      productos: 8,
      clientes: 3,
      ventas: 5,
      cotizaciones: 2,
    })
  })

  it("deja las dos cuentas de demostración", () => {
    sembrarDatosDemo()

    const usuarios = leerJSON("ferreteria_users", [])
    const nombres = usuarios.map((u) => u.username)

    expect(nombres).toContain(CREDENCIALES_DEMO.usuario)
    expect(nombres).toContain(CREDENCIALES_DEMO_ADMIN.usuario)
  })

  it("guarda las contraseñas con el mismo hash que usa el login", () => {
    sembrarDatosDemo()

    const vendedor = leerJSON("ferreteria_users", []).find(
      (u) => u.username === CREDENCIALES_DEMO.usuario
    )

    expect(vendedor.passwordHash).toBe(
      hashPassword(CREDENCIALES_DEMO.contrasena)
    )
  })

  it("el vendedor no tiene inventario ni configuración", () => {
    sembrarDatosDemo()

    const vendedor = leerJSON("ferreteria_users", []).find(
      (u) => u.username === CREDENCIALES_DEMO.usuario
    )

    expect(vendedor.permissions).toContain("pos")
    expect(vendedor.permissions).not.toContain("products")
    expect(vendedor.permissions).not.toContain("settings")
  })

  it("el administrador tiene el rol admin", () => {
    sembrarDatosDemo()

    const admin = leerJSON("ferreteria_users", []).find(
      (u) => u.username === CREDENCIALES_DEMO_ADMIN.usuario
    )

    expect(admin.role).toBe("admin")
  })

  it("no deja ninguna sesión abierta", () => {
    localStorage.setItem("ferreteria_session_user_id", "alguien")

    sembrarDatosDemo()

    expect(localStorage.getItem("ferreteria_session_user_id")).toBeNull()
  })
})

describe("los datos de ejemplo muestran cada estado", () => {
  it("incluye un producto agotado y uno bajo en existencias", () => {
    sembrarDatosDemo()

    const productos = leerJSON("products", [])

    expect(productos.some((p) => p.stock === 0)).toBe(true)
    expect(
      productos.some((p) => p.stock > 0 && p.stock <= p.minStock)
    ).toBe(true)
  })

  it("incluye ventas de contado y de crédito", () => {
    sembrarDatosDemo()

    const ventas = leerJSON("sales", [])

    expect(ventas.some((v) => v.paymentType === "contado")).toBe(true)
    expect(ventas.some((v) => v.paymentType === "credito")).toBe(true)
  })

  it("incluye una factura con abono parcial y saldo pendiente", () => {
    sembrarDatosDemo()

    const conAbono = leerJSON("sales", []).find(
      (v) => (v.payments || []).length > 0
    )

    expect(conAbono).toBeTruthy()
    expect(getSaleBalance(conAbono)).toBeGreaterThan(0)
  })

  it("incluye una factura de crédito vencida", () => {
    sembrarDatosDemo()

    const vencidas = leerJSON("sales", []).filter(
      (v) =>
        v.paymentType === "credito" &&
        v.status === "pendiente" &&
        new Date(`${v.dueDate}T00:00:00`) < new Date()
    )

    expect(vencidas.length).toBeGreaterThan(0)
  })

  it("incluye una cotización vigente y una vencida", () => {
    sembrarDatosDemo()

    const estados = leerJSON("quotes", []).map(
      (c) => getQuoteStatus(c).code
    )

    expect(estados).toContain("vigente")
    expect(estados).toContain("vencida")
  })

  it("los totales de cada venta cuadran con su detalle", () => {
    sembrarDatosDemo()

    leerJSON("sales", []).forEach((venta) => {
      const suma = venta.items.reduce((s, i) => s + i.subtotal, 0)

      expect(venta.subtotal).toBeCloseTo(suma, 2)
      expect(venta.total).toBeCloseTo(venta.subtotal + venta.tax, 2)
    })
  })
})
