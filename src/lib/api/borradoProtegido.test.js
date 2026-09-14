import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { desactivarProducto, traerProductos } from "./catalogos"
import { eliminarAbono } from "./ventas"
import { crearSupabaseFalso } from "../../test/supabaseFalso"

/*
  0013 quitó la posibilidad de borrar documentos emitidos.

  Hasta entonces cualquier usuario con sesión podía borrar cualquier
  factura de su ferretería con una llamada a la API: no hacía falta botón
  ni ser administrador. Y el borrado arrastraba los renglones y los abonos
  —los recibos del dinero que el cliente ya había pagado— dejando además el
  descuento de inventario sin factura que lo explicara.

  Estas pruebas van contra el cliente de Supabase y no contra una función
  de la aplicación, porque no existe ninguna que borre: lo que se comprueba
  es que la puerta esté cerrada aunque alguien la busque.
*/

vi.mock("../supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const EMPRESA = "empresa-1"

const montar = () => {
  const falso = crearSupabaseFalso({
    tablas: {
      empresas: [{ id: EMPRESA, nombre: "Ferretería" }],
      productos: [
        {
          id: "p1",
          empresa_id: EMPRESA,
          codigo: "M-001",
          nombre: "Martillo",
          activo: true,
        },
        {
          id: "p2",
          empresa_id: EMPRESA,
          codigo: "R-002",
          nombre: "Recién creado",
          activo: true,
        },
      ],
      ventas: [
        {
          id: "v1",
          empresa_id: EMPRESA,
          numero_factura: "FAC-01210",
          correlativo: 1210,
          total: 230,
          forma_pago: "credito",
          estado: "pendiente",
        },
      ],
      detalle_venta: [
        {
          id: "d1",
          empresa_id: EMPRESA,
          venta_id: "v1",
          producto_id: "p1",
          cantidad: 2,
          precio: 100,
          subtotal: 200,
        },
      ],
      abonos: [
        { id: "ab1", empresa_id: EMPRESA, venta_id: "v1", monto: 100 },
      ],
      movimientos_inventario: [
        {
          id: "mov-1",
          empresa_id: EMPRESA,
          producto_id: "p1",
          tipo: "entrada",
          cantidad: 10,
          motivo: "Existencia inicial",
        },
        {
          id: "mov-2",
          empresa_id: EMPRESA,
          producto_id: "p1",
          venta_id: "v1",
          tipo: "salida",
          cantidad: -2,
          motivo: "Venta",
        },
      ],
    },
  })

  globalThis.__supabaseFalso = falso

  return falso
}

const borrar = (falso, tabla, id) =>
  falso.from(tabla).delete().eq("id", id)

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("una factura emitida no se puede borrar", () => {
  it("rechaza el borrado de la venta", async () => {
    const falso = montar()

    const { error } = await borrar(falso, "ventas", "v1")

    expect(error).toBeTruthy()
    expect(error.code).toBe("42501")
    expect(falso.datos.ventas).toHaveLength(1)
  })

  it("conserva los renglones, los abonos y los movimientos", async () => {
    const falso = montar()

    await borrar(falso, "ventas", "v1")

    expect(falso.datos.detalle_venta).toHaveLength(1)
    expect(falso.datos.abonos).toHaveLength(1)
    expect(falso.datos.movimientos_inventario).toHaveLength(2)
  })

  /*
    El número emitido es lo que el SAR exige que sea continuo. Si la
    factura desapareciera, el correlativo quedaría sin documento que lo
    respalde: el mismo hueco que 0012 cerró por el lado de la emisión.
  */
  it("conserva el documento y su correlativo", async () => {
    const falso = montar()

    await borrar(falso, "ventas", "v1")

    expect(falso.datos.ventas[0].numero_factura).toBe("FAC-01210")
    expect(falso.datos.ventas[0].correlativo).toBe(1210)
  })

  it("rechaza borrar los renglones por separado", async () => {
    const falso = montar()

    const { error } = await borrar(falso, "detalle_venta", "d1")

    expect(error.code).toBe("42501")
    expect(falso.datos.detalle_venta).toHaveLength(1)
  })

  /*
    El libro de movimientos es de solo agregar: un asiento equivocado se
    corrige con otro que lo compense, no borrándolo.
  */
  it("rechaza borrar un movimiento de inventario", async () => {
    const falso = montar()

    const { error } = await borrar(falso, "movimientos_inventario", "mov-2")

    expect(error.code).toBe("42501")
    expect(falso.datos.movimientos_inventario).toHaveLength(2)
  })

  /*
    Los abonos sí se pueden corregir, y tiene que seguir siendo así: el
    flujo de anulación de una factura a crédito exige que el administrador
    los elimine antes.
  */
  it("mantiene la corrección de abonos, que la anulación necesita", async () => {
    const falso = montar()

    await eliminarAbono("ab1")

    expect(falso.datos.abonos).toHaveLength(0)
  })
})

describe("borrar un producto no puede llevarse su Kardex", () => {
  it("rechaza borrar un producto con movimientos", async () => {
    const falso = montar()

    const { error } = await borrar(falso, "productos", "p1")

    expect(error.code).toBe("23503")
    expect(falso.datos.productos).toHaveLength(2)
    expect(falso.datos.movimientos_inventario).toHaveLength(2)
  })

  /*
    Uno sin historial sí: no hay nada que destruir. Es el caso de un
    producto recién creado por equivocación.
  */
  it("permite borrar uno que nunca se movió", async () => {
    const falso = montar()

    const { error } = await borrar(falso, "productos", "p2")

    expect(error).toBeNull()
    expect(falso.datos.productos.map((p) => p.id)).toEqual(["p1"])
  })

  it("la baja lógica sigue siendo la operación normal", async () => {
    const falso = montar()

    await desactivarProducto("p1")

    expect(falso.datos.productos.find((p) => p.id === "p1").activo).toBe(false)
    expect(falso.datos.movimientos_inventario).toHaveLength(2)

    const enElCatalogo = await traerProductos()

    expect(enElCatalogo.map((p) => p.id)).not.toContain("p1")
  })
})
