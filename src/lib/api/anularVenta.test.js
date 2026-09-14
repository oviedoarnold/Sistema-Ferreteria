import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { anularVenta, ajustarEstadoPorSaldo, crearAbono } from "./ventas"
import { crearSupabaseFalso } from "../../test/supabaseFalso"

vi.mock("../supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const EMPRESA = "empresa-1"
const OTRA_EMPRESA = "empresa-2"
const ADMIN = "auth-admin"
const VENDEDOR = "auth-vendedor"

const MOTIVO = "factura emitida por equivocación"

const montar = ({
  quienEntra = ADMIN,
  empresaDeLaVenta = EMPRESA,
  estado = "pagada",
  formaPago = "contado",
  abonos = [],
} = {}) => {
  const falso = crearSupabaseFalso({
    tablas: {
      empresas: [
        {
          id: EMPRESA,
          nombre: "Ferretería",
          proximo_correlativo_factura: 1212,
        },
      ],
      usuarios: [
        {
          id: "u-admin",
          auth_id: ADMIN,
          empresa_id: EMPRESA,
          email: "admin@ferreteria.test",
          rol: "admin",
          activo: true,
        },
        {
          id: "u-vendedor",
          auth_id: VENDEDOR,
          empresa_id: EMPRESA,
          email: "vendedor@ferreteria.test",
          rol: "vendedor",
          activo: true,
        },
      ],
      productos: [
        { id: "p1", empresa_id: EMPRESA, nombre: "Martillo", activo: true },
        { id: "p2", empresa_id: EMPRESA, nombre: "Clavos", activo: true },
      ],
      clientes: [{ id: "c1", empresa_id: EMPRESA, nombre: "Cliente" }],
      ventas: [
        {
          id: "v1",
          empresa_id: empresaDeLaVenta,
          cliente_id: formaPago === "credito" ? "c1" : null,
          usuario_id: "u-vendedor",
          numero_factura: "FAC-01211",
          correlativo: 1211,
          total: 575,
          forma_pago: formaPago,
          estado,
        },
      ],
      detalle_venta: [
        {
          id: "d1",
          empresa_id: EMPRESA,
          venta_id: "v1",
          producto_id: "p1",
          cantidad: 5,
          precio: 100,
          subtotal: 500,
        },
        {
          id: "d2",
          empresa_id: EMPRESA,
          venta_id: "v1",
          producto_id: "p2",
          cantidad: 3,
          precio: 10,
          subtotal: 30,
        },
      ],
      abonos,
      movimientos_inventario: [
        {
          id: "mov-1",
          empresa_id: EMPRESA,
          producto_id: "p1",
          tipo: "entrada",
          cantidad: 20,
          motivo: "Existencia inicial",
        },
        {
          id: "mov-2",
          empresa_id: EMPRESA,
          producto_id: "p2",
          tipo: "entrada",
          cantidad: 20,
          motivo: "Existencia inicial",
        },
        {
          id: "mov-3",
          empresa_id: EMPRESA,
          producto_id: "p1",
          venta_id: "v1",
          usuario_id: "u-vendedor",
          tipo: "salida",
          cantidad: -5,
          motivo: "Venta",
        },
        {
          id: "mov-4",
          empresa_id: EMPRESA,
          producto_id: "p2",
          venta_id: "v1",
          usuario_id: "u-vendedor",
          tipo: "salida",
          cantidad: -3,
          motivo: "Venta",
        },
      ],
    },
    sesionInicial: { user: { id: quienEntra } },
  })

  globalThis.__supabaseFalso = falso

  return falso
}

const stockDe = (falso, productoId) =>
  falso.datos.movimientos_inventario
    .filter((m) => m.producto_id === productoId)
    .reduce((suma, m) => suma + Number(m.cantidad), 0)

const compensatoriosDe = (falso) =>
  falso.datos.movimientos_inventario.filter((m) => m.tipo === "devolucion")

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("anular una factura", () => {
  it("la marca anulada con quién, cuándo y por qué", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    const [factura] = falso.datos.ventas

    expect(factura.estado).toBe("anulada")
    expect(factura.motivo_anulacion).toBe(MOTIVO)
    expect(factura.anulada_por).toBe("u-admin")
    expect(factura.anulada_at).toBeTruthy()
  })

  it("firma la anulación con quien la hizo, no con quien vendió", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    expect(falso.datos.ventas[0].usuario_id).toBe("u-vendedor")
    expect(compensatoriosDe(falso).every((m) => m.usuario_id === "u-admin"))
      .toBe(true)
  })

  it("devuelve al inventario exactamente lo que salió", async () => {
    const falso = montar()

    expect(stockDe(falso, "p1")).toBe(15)
    expect(stockDe(falso, "p2")).toBe(17)

    await anularVenta("v1", MOTIVO)

    expect(stockDe(falso, "p1")).toBe(20)
    expect(stockDe(falso, "p2")).toBe(20)
  })

  /*
    Lo que distingue anular de borrar: la salida original sigue en el libro.
    Si desapareciera, el Kardex diría que la venta nunca ocurrió.
  */
  it("conserva los movimientos originales de la venta", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    const salidas = falso.datos.movimientos_inventario.filter(
      (m) => m.tipo === "salida"
    )

    expect(salidas).toHaveLength(2)
    expect(salidas.map((m) => m.cantidad).sort()).toEqual([-5, -3].sort())
  })

  it("agrega un movimiento de devolución por cada renglón", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    const compensatorios = compensatoriosDe(falso)

    expect(compensatorios).toHaveLength(2)
    expect(compensatorios.map((m) => m.cantidad).sort()).toEqual([3, 5])
    expect(compensatorios.every((m) => m.venta_id === "v1")).toBe(true)
    expect(compensatorios.every((m) => m.motivo === "Anulación FAC-01211"))
      .toBe(true)
  })

  /*
    El libro tiene que poder leerse como "se vendió y después se deshizo":
    las dos líneas bajo la misma factura, sumando cero en neto.
  */
  it("deja la factura en cero neto sin borrar su historia", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    const delDocumento = falso.datos.movimientos_inventario.filter(
      (m) => m.venta_id === "v1"
    )

    expect(delDocumento).toHaveLength(4)
    expect(delDocumento.reduce((suma, m) => suma + m.cantidad, 0)).toBe(0)
  })

  /*
    Anular no libera el número. El correlativo pertenece a la numeración
    autorizada y el documento anulado sigue siendo su dueño.
  */
  it("conserva el número de factura y no libera el correlativo", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    expect(falso.datos.ventas[0].numero_factura).toBe("FAC-01211")
    expect(falso.datos.ventas[0].correlativo).toBe(1211)
    expect(falso.datos.empresas[0].proximo_correlativo_factura).toBe(1212)
  })

  it("conserva los renglones de la factura", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    expect(falso.datos.detalle_venta).toHaveLength(2)
  })
})

describe("la base rechaza una anulación que no debe ocurrir", () => {
  const noDebeAnularse = async (falso, patron) => {
    await expect(anularVenta("v1", MOTIVO)).rejects.toThrow(patron)

    expect(falso.datos.ventas[0].estado).not.toBe("anulada")
    expect(compensatoriosDe(falso)).toHaveLength(0)
  }

  it("rechaza a un vendedor", async () => {
    const falso = montar({ quienEntra: VENDEDOR })

    await noDebeAnularse(falso, /administrador/i)
  })

  it("rechaza a quien no tiene sesión válida", async () => {
    const falso = montar({ quienEntra: "auth-desconocido" })

    await noDebeAnularse(falso, /sesión/i)
  })

  it("rechaza una factura de otra ferretería", async () => {
    const falso = montar({ empresaDeLaVenta: OTRA_EMPRESA })

    await noDebeAnularse(falso, /no existe|no pertenece/i)
  })

  it("rechaza una factura que no existe", async () => {
    const falso = montar()

    await expect(anularVenta("zzz", MOTIVO)).rejects.toThrow(/no existe/i)

    expect(compensatoriosDe(falso)).toHaveLength(0)
  })

  it("exige un motivo", async () => {
    const falso = montar()

    await expect(anularVenta("v1", "   ")).rejects.toThrow(/motivo/i)

    expect(falso.datos.ventas[0].estado).not.toBe("anulada")
  })

  /*
    Un motivo de una o dos letras vacía de sentido a la columna: la
    auditoría guardaría filas que dicen "se anuló" sin decir por qué.
  */
  it("rechaza un motivo demasiado corto", async () => {
    const falso = montar()

    await expect(anularVenta("v1", "err")).rejects.toThrow(/5 caracteres/i)

    expect(falso.datos.ventas[0].estado).not.toBe("anulada")
  })

  /*
    Si dos administradores anulan a la vez, el segundo tiene que rebotar sin
    devolver la mercadería otra vez. Contra PostgreSQL lo garantiza el
    candado sobre la venta; aquí se comprueba el efecto: el segundo intento
    no agrega un segundo juego de compensatorios.
  */
  it("rechaza la segunda anulación y no duplica la devolución", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)

    await expect(anularVenta("v1", "segundo intento de anulación")).rejects
      .toThrow(/ya estaba anulada/i)

    expect(compensatoriosDe(falso)).toHaveLength(2)
    expect(stockDe(falso, "p1")).toBe(20)
    expect(falso.datos.ventas[0].motivo_anulacion).toBe(MOTIVO)
  })
})

describe("facturas a crédito", () => {
  it("anula una a crédito que no tiene abonos", async () => {
    const falso = montar({ formaPago: "credito", estado: "pendiente" })

    await anularVenta("v1", "el cliente canceló el pedido")

    expect(falso.datos.ventas[0].estado).toBe("anulada")
    expect(stockDe(falso, "p1")).toBe(20)
  })

  /*
    Anular una factura ya cobrada es un hecho de caja, no de inventario: el
    dinero entró. Deshacerlo desde aquí haría que el sistema afirmara que
    ese cobro nunca existió.
  */
  it("rechaza una con abonos y explica qué hacer", async () => {
    const falso = montar({
      formaPago: "credito",
      estado: "pendiente",
      abonos: [
        { id: "ab1", empresa_id: EMPRESA, venta_id: "v1", monto: 300 },
        { id: "ab2", empresa_id: EMPRESA, venta_id: "v1", monto: 150 },
      ],
    })

    await expect(anularVenta("v1", MOTIVO)).rejects.toThrow(
      /2 abono\(s\) registrado\(s\) por L 450\.00.*Elimina los abonos/is
    )

    expect(falso.datos.ventas[0].estado).toBe("pendiente")
    expect(compensatoriosDe(falso)).toHaveLength(0)
  })

  it("no toca los abonos al rechazar", async () => {
    const falso = montar({
      formaPago: "credito",
      estado: "pendiente",
      abonos: [{ id: "ab1", empresa_id: EMPRESA, venta_id: "v1", monto: 300 }],
    })

    await expect(anularVenta("v1", MOTIVO)).rejects.toThrow()

    expect(falso.datos.abonos).toHaveLength(1)
    expect(falso.datos.abonos[0].monto).toBe(300)
  })

  /*
    El camino completo del flujo aprobado: el administrador quita los
    abonos de forma explícita y recién entonces puede anular.
  */
  it("permite anular después de quitar los abonos", async () => {
    const falso = montar({
      formaPago: "credito",
      estado: "pendiente",
      abonos: [{ id: "ab1", empresa_id: EMPRESA, venta_id: "v1", monto: 300 }],
    })

    await expect(anularVenta("v1", MOTIVO)).rejects.toThrow(/abono/i)

    await falso.from("abonos").delete().eq("id", "ab1")
    await anularVenta("v1", "el cliente devolvió la mercadería")

    expect(falso.datos.ventas[0].estado).toBe("anulada")
  })
})

describe("una factura anulada no vuelve atrás", () => {
  /*
    ajustarEstadoPorSaldo escribía el estado a ciegas. Registrar o corregir
    un abono sobre una factura ya anulada la devolvía a pagada o pendiente,
    dejando el estado diciendo una cosa y anulada_por la contraria.
  */
  it("el ajuste por saldo no la devuelve a pendiente", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)
    await ajustarEstadoPorSaldo("v1", 500)

    expect(falso.datos.ventas[0].estado).toBe("anulada")
  })

  it("el ajuste por saldo no la devuelve a pagada", async () => {
    const falso = montar()

    await anularVenta("v1", MOTIVO)
    await ajustarEstadoPorSaldo("v1", 0)

    expect(falso.datos.ventas[0].estado).toBe("anulada")
  })

  it("sigue ajustando el estado de las que no están anuladas", async () => {
    const falso = montar({ formaPago: "credito", estado: "pendiente" })

    await ajustarEstadoPorSaldo("v1", 0)

    expect(falso.datos.ventas[0].estado).toBe("pagada")
  })

  it("conserva el rastro aunque se registre un abono después", async () => {
    const falso = montar({ formaPago: "credito", estado: "pendiente" })

    await anularVenta("v1", MOTIVO)

    await crearAbono(
      "v1",
      { amount: 100, note: "" },
      { empresaId: EMPRESA, usuarioId: "u-admin" }
    )
    await ajustarEstadoPorSaldo("v1", 475)

    const [factura] = falso.datos.ventas

    expect(factura.estado).toBe("anulada")
    expect(factura.anulada_por).toBe("u-admin")
    expect(factura.motivo_anulacion).toBe(MOTIVO)
  })
})
