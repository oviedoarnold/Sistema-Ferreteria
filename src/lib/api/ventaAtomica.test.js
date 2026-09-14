import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { crearVenta } from "./ventas"
import { crearSupabaseFalso } from "../../test/supabaseFalso"

vi.mock("../supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const EMPRESA = "empresa-1"
const OTRA_EMPRESA = "empresa-2"
const AUTH_ID = "auth-1"

const producto = (cambios = {}) => ({
  id: "p1",
  empresa_id: EMPRESA,
  codigo: "M-001",
  nombre: "Martillo",
  activo: true,
  ...cambios,
})

const montar = ({
  existencias = 10,
  productos = [producto()],
  clientes = [],
  conSesion = true,
  empresa = {},
} = {}) => {
  const falso = crearSupabaseFalso({
    tablas: {
      empresas: [
        {
          id: EMPRESA,
          nombre: "Ferretería",
          proximo_correlativo_factura: 1000,
          proximo_correlativo_cotizacion: 2000,
          ...empresa,
        },
      ],
      usuarios: [
        {
          id: "usuario-1",
          auth_id: AUTH_ID,
          empresa_id: EMPRESA,
          email: "vendedor@ferreteria.test",
          nombre: "Vendedor",
          rol: "vendedor",
          activo: true,
        },
      ],
      productos,
      clientes,
      ventas: [],
      detalle_venta: [],
      movimientos_inventario: productos.map((p, i) => ({
        id: "mov-" + i,
        empresa_id: EMPRESA,
        producto_id: p.id,
        tipo: "entrada",
        cantidad: existencias,
        motivo: "Existencia inicial",
      })),
    },
    sesionInicial: conSesion ? { user: { id: AUTH_ID } } : null,
  })

  globalThis.__supabaseFalso = falso

  return falso
}

const venta = (cambios = {}) => ({
  items: [{ productId: "p1", qty: 2, price: 100 }],
  taxRate: 15,
  paymentType: "contado",
  customerName: "Consumidor Final",
  ...cambios,
})

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("emitir una factura", () => {
  it("escribe cabecera, renglones y salida de inventario juntos", async () => {
    const falso = montar()

    const id = await crearVenta(venta())

    expect(falso.datos.ventas).toHaveLength(1)
    expect(falso.datos.detalle_venta).toHaveLength(1)
    expect(falso.datos.movimientos_inventario.filter((m) => m.venta_id === id))
      .toHaveLength(1)
  })

  it("descarga del inventario exactamente lo vendido", async () => {
    const falso = montar()

    const id = await crearVenta(venta())

    const salida = falso.datos.movimientos_inventario.find(
      (m) => m.venta_id === id
    )

    expect(salida.tipo).toBe("salida")
    expect(salida.cantidad).toBe(-2)
  })

  /*
    Los importes no viajan desde el navegador: los calcula la base. Aquí se
    envían totales falsos a propósito para comprobar que se ignoran.
  */
  it("recalcula los totales e ignora los que envía el navegador", async () => {
    const falso = montar()

    await crearVenta(venta({ subtotal: 1, tax: 1, total: 1 }))

    const [factura] = falso.datos.ventas

    expect(factura.subtotal).toBe(200)
    expect(factura.isv).toBe(30)
    expect(factura.total).toBe(230)
  })

  it("firma la venta con el usuario de la sesión, no con uno recibido", async () => {
    const falso = montar()

    await crearVenta(venta(), { usuarioId: "usuario-inventado" })

    expect(falso.datos.ventas[0].usuario_id).toBe("usuario-1")
    expect(falso.datos.ventas[0].empresa_id).toBe(EMPRESA)
  })

  it("marca pagada la de contado y pendiente la de crédito", async () => {
    const falso = montar({ clientes: [{ id: "c1", empresa_id: EMPRESA }] })

    await crearVenta(venta())
    await crearVenta(
      venta({ paymentType: "credito", clientId: "c1", dueDate: "2027-01-31" })
    )

    expect(falso.datos.ventas.map((v) => v.estado)).toEqual([
      "pagada",
      "pendiente",
    ])
  })

  it("usa la numeración interna sin datos fiscales", async () => {
    const falso = montar()

    await crearVenta(venta())

    expect(falso.datos.ventas[0].numero_factura).toBe("FAC-01000")
  })

  it("usa la numeración autorizada cuando hay CAI, rango y fecha límite", async () => {
    const falso = montar({
      empresa: {
        cai: "ABC-123",
        rango_desde: 1,
        rango_hasta: 9999,
        fecha_limite_emision: "2030-12-31",
        establecimiento: "000",
        punto_emision: "001",
        tipo_documento: "01",
      },
    })

    await crearVenta(venta())

    expect(falso.datos.ventas[0].numero_factura).toBe("000-001-01-00001000")
    expect(falso.datos.ventas[0].cai_emision).toBe("ABC-123")
  })
})

describe("la base rechaza una venta que no debe emitirse", () => {
  const noDebeEscribirNada = (falso) => {
    expect(falso.datos.ventas).toHaveLength(0)
    expect(falso.datos.detalle_venta).toHaveLength(0)
    expect(
      falso.datos.movimientos_inventario.filter((m) => m.venta_id)
    ).toHaveLength(0)
  }

  it("rechaza vender más de lo que hay", async () => {
    const falso = montar({ existencias: 1 })

    await expect(crearVenta(venta())).rejects.toThrow(/Stock insuficiente/i)

    noDebeEscribirNada(falso)
  })

  /*
    El correlativo pertenece a la numeración autorizada. Consumir uno en un
    intento fallido dejaría un hueco en la secuencia.
  */
  it("no consume correlativo cuando rechaza", async () => {
    const falso = montar({ existencias: 1 })

    await expect(crearVenta(venta())).rejects.toThrow()

    expect(falso.datos.empresas[0].proximo_correlativo_factura).toBe(1000)
  })

  it("rechaza un producto que ya no existe", async () => {
    const falso = montar()

    await expect(
      crearVenta(venta({ items: [{ productId: "zzz", qty: 1, price: 10 }] }))
    ).rejects.toThrow(/ya no existe/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza un producto desactivado", async () => {
    const falso = montar({ productos: [producto({ activo: false })] })

    await expect(crearVenta(venta())).rejects.toThrow(/ya no está disponible/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza un producto de otra ferretería", async () => {
    const falso = montar({
      productos: [producto({ empresa_id: OTRA_EMPRESA })],
    })

    await expect(crearVenta(venta())).rejects.toThrow(/ya no existe/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza un cliente de otra ferretería", async () => {
    const falso = montar({
      clientes: [{ id: "c1", empresa_id: OTRA_EMPRESA }],
    })

    await expect(
      crearVenta(venta({ paymentType: "credito", clientId: "c1" }))
    ).rejects.toThrow(/no pertenece a esta ferretería/i)

    noDebeEscribirNada(falso)
  })

  it("exige cliente para vender al crédito", async () => {
    const falso = montar()

    await expect(
      crearVenta(venta({ paymentType: "credito" }))
    ).rejects.toThrow(/cliente registrado/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza un carrito vacío", async () => {
    const falso = montar()

    await expect(crearVenta(venta({ items: [] }))).rejects.toThrow(
      /al menos un producto/i
    )

    noDebeEscribirNada(falso)
  })

  it("rechaza una cantidad de cero o menos", async () => {
    const falso = montar()

    await expect(
      crearVenta(venta({ items: [{ productId: "p1", qty: 0, price: 100 }] }))
    ).rejects.toThrow(/mayor que cero/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza una forma de pago que no existe", async () => {
    const falso = montar()

    await expect(
      crearVenta(venta({ paymentType: "tarjeta" }))
    ).rejects.toThrow(/Forma de pago no válida/i)

    noDebeEscribirNada(falso)
  })

  it("rechaza a quien no tiene sesión válida", async () => {
    const falso = montar({ conSesion: false })

    await expect(crearVenta(venta())).rejects.toThrow(/sesión/i)

    noDebeEscribirNada(falso)
  })

  /*
    Si el mismo producto viene en dos renglones, lo que tiene que alcanzar
    es la suma. Validarlos por separado dejaría pasar una venta de 6
    unidades teniendo 4.
  */
  it("suma las cantidades cuando el producto viene repetido", async () => {
    const falso = montar({ existencias: 4 })

    await expect(
      crearVenta(
        venta({
          items: [
            { productId: "p1", qty: 3, price: 100 },
            { productId: "p1", qty: 3, price: 100 },
          ],
        })
      )
    ).rejects.toThrow(/Stock insuficiente/i)

    noDebeEscribirNada(falso)
  })
})
