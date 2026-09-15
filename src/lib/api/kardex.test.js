import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { traerKardex, FILAS_POR_PAGINA } from "./kardex"
import { crearSupabaseFalso } from "../../test/supabaseFalso"

vi.mock("../supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const EMPRESA = "empresa-1"

const dia = (n) => `2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z`

/*
  Un libro pequeño pero con los cuatro tipos y las dos formas de relación
  con una venta, que es lo que la pantalla tiene que saber distinguir.
*/
const MOVIMIENTOS = [
  {
    id: 1,
    empresa_id: EMPRESA,
    producto_id: "p1",
    usuario_id: "u-admin",
    tipo: "entrada",
    cantidad: 20,
    motivo: "Inventario inicial",
    fecha: dia(1),
  },
  {
    id: 2,
    empresa_id: EMPRESA,
    producto_id: "p2",
    usuario_id: "u-admin",
    tipo: "entrada",
    cantidad: 50,
    motivo: "Inventario inicial",
    fecha: dia(1),
  },
  {
    id: 3,
    empresa_id: EMPRESA,
    producto_id: "p1",
    usuario_id: "u-vendedor",
    venta_id: "v1",
    tipo: "salida",
    cantidad: -3,
    motivo: "Venta",
    fecha: dia(3),
  },
  {
    id: 4,
    empresa_id: EMPRESA,
    producto_id: "p1",
    usuario_id: "u-admin",
    tipo: "ajuste",
    cantidad: 10,
    motivo: "Ajuste manual desde inventario",
    fecha: dia(5),
  },
  {
    id: 5,
    empresa_id: EMPRESA,
    producto_id: "p1",
    usuario_id: "u-admin",
    venta_id: "v1",
    tipo: "devolucion",
    cantidad: 3,
    motivo: "Anulación FAC-01210",
    fecha: dia(6),
  },
]

const montar = ({ movimientos = MOVIMIENTOS, fallarEn } = {}) => {
  const falso = crearSupabaseFalso({
    tablas: {
      empresas: [{ id: EMPRESA, nombre: "Ferretería" }],
      usuarios: [
        { id: "u-admin", empresa_id: EMPRESA, nombre: "Administrador" },
        { id: "u-vendedor", empresa_id: EMPRESA, nombre: "Vendedor" },
      ],
      productos: [
        { id: "p1", empresa_id: EMPRESA, nombre: "Martillo", codigo: "HER-001" },
        { id: "p2", empresa_id: EMPRESA, nombre: "Cemento", codigo: "CEM-001" },
      ],
      ventas: [
        { id: "v1", empresa_id: EMPRESA, numero_factura: "FAC-01210" },
      ],
      movimientos_inventario: movimientos,
    },
    fallarEn,
  })

  globalThis.__supabaseFalso = falso

  return falso
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("consultar el libro de movimientos", () => {
  it("trae los movimientos con su producto, documento y usuario", async () => {
    montar()

    const { filas, total } = await traerKardex()

    expect(total).toBe(5)

    const venta = filas.find((f) => f.id === 3)

    expect(venta.producto).toBe("Martillo")
    expect(venta.codigo).toBe("HER-001")
    expect(venta.numero_factura).toBe("FAC-01210")
    expect(venta.usuario).toBe("Vendedor")
  })

  /*
    Lo más reciente arriba. Es el orden inverso al que usa la vista para
    acumular el saldo, y no hay que confundirlos.
  */
  it("muestra primero lo más reciente", async () => {
    montar()

    const { filas } = await traerKardex()

    expect(filas.map((f) => f.id)).toEqual([5, 4, 3, 2, 1])
  })

  it("desempata por id cuando dos movimientos comparten la fecha", async () => {
    montar()

    const { filas } = await traerKardex()
    const delPrimerDia = filas.filter((f) => f.fecha === dia(1))

    expect(delPrimerDia.map((f) => f.id)).toEqual([2, 1])
  })

  it("deja sin documento los movimientos que no vienen de una venta", async () => {
    montar()

    const { filas } = await traerKardex()

    expect(filas.find((f) => f.id === 4).numero_factura).toBeNull()
    expect(filas.find((f) => f.id === 1).numero_factura).toBeNull()
  })
})

describe("el saldo acumulado", () => {
  it("es el stock del producto después de cada movimiento", async () => {
    montar()

    const { filas } = await traerKardex({ filtros: { productoId: "p1" } })
    const porId = Object.fromEntries(filas.map((f) => [f.id, f.saldo]))

    expect(porId[1]).toBe(20) // entrada
    expect(porId[3]).toBe(17) // venta de 3
    expect(porId[4]).toBe(27) // ajuste de +10
    expect(porId[5]).toBe(30) // anulación devuelve 3
  })

  it("lo lleva por producto y no mezcla el de otros", async () => {
    montar()

    const { filas } = await traerKardex({ filtros: { productoId: "p2" } })

    expect(filas.map((f) => f.saldo)).toEqual([50])
  })

  /*
    La propiedad que permite paginar y filtrar sin romper el saldo: la suma
    se calcula sobre todo el libro, no sobre las filas que sobrevivieron al
    filtro. Si se calculara después, esta devolución diría 3 en vez de 30.
  */
  it("no cambia porque se filtre por tipo", async () => {
    montar()

    const { filas } = await traerKardex({
      filtros: { productoId: "p1", tipo: "devolucion" },
    })

    expect(filas).toHaveLength(1)
    expect(filas[0].saldo).toBe(30)
  })

  it("no cambia porque se filtre por fecha", async () => {
    montar()

    const { filas } = await traerKardex({
      filtros: { productoId: "p1", desde: "2026-09-05" },
    })

    expect(filas.map((f) => f.saldo)).toEqual([30, 27])
  })
})

describe("los filtros viajan a la base", () => {
  it("filtra por producto", async () => {
    montar()

    const { filas, total } = await traerKardex({
      filtros: { productoId: "p2" },
    })

    expect(total).toBe(1)
    expect(filas.every((f) => f.producto === "Cemento")).toBe(true)
  })

  it("filtra por tipo de movimiento", async () => {
    montar()

    const { filas, total } = await traerKardex({ filtros: { tipo: "entrada" } })

    expect(total).toBe(2)
    expect(filas.every((f) => f.tipo === "entrada")).toBe(true)
  })

  it("filtra desde una fecha", async () => {
    montar()

    const { filas } = await traerKardex({ filtros: { desde: "2026-09-05" } })

    expect(filas.map((f) => f.id)).toEqual([5, 4])
  })

  /*
    "Hasta el 3" tiene que incluir el día 3 entero. Comparando contra la
    fecha pelada se perdería todo lo registrado después de la medianoche,
    que es casi todo.
  */
  it("filtra hasta una fecha incluyendo ese día completo", async () => {
    montar()

    const { filas } = await traerKardex({ filtros: { hasta: "2026-09-03" } })

    expect(filas.map((f) => f.id)).toEqual([3, 2, 1])
  })

  it("combina desde y hasta", async () => {
    montar()

    const { filas } = await traerKardex({
      filtros: { desde: "2026-09-03", hasta: "2026-09-05" },
    })

    expect(filas.map((f) => f.id)).toEqual([4, 3])
  })

  it("busca por nombre de producto", async () => {
    montar()

    const { filas, total } = await traerKardex({
      filtros: { busqueda: "marti" },
    })

    expect(total).toBe(4)
    expect(filas.every((f) => f.producto === "Martillo")).toBe(true)
  })

  it("busca también por código", async () => {
    montar()

    const { filas } = await traerKardex({ filtros: { busqueda: "CEM-001" } })

    expect(filas.map((f) => f.producto)).toEqual(["Cemento"])
  })

  it("ignora una búsqueda de puros espacios", async () => {
    montar()

    const { total } = await traerKardex({ filtros: { busqueda: "   " } })

    expect(total).toBe(5)
  })

  it("no devuelve nada cuando la búsqueda no calza", async () => {
    montar()

    const { filas, total } = await traerKardex({
      filtros: { busqueda: "taladro" },
    })

    expect(filas).toHaveLength(0)
    expect(total).toBe(0)
  })
})

describe("paginación", () => {
  const muchos = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    empresa_id: EMPRESA,
    producto_id: "p1",
    usuario_id: "u-admin",
    tipo: "entrada",
    cantidad: 1,
    motivo: "Carga",
    fecha: dia(1),
  }))

  it("trae 25 filas por página", async () => {
    montar({ movimientos: muchos })

    const { filas, total } = await traerKardex()

    expect(filas).toHaveLength(FILAS_POR_PAGINA)
    expect(total).toBe(60)
  })

  it("la segunda página continúa donde terminó la primera", async () => {
    montar({ movimientos: muchos })

    const primera = await traerKardex({ pagina: 1 })
    const segunda = await traerKardex({ pagina: 2 })

    expect(segunda.filas[0].id).toBe(primera.filas.at(-1).id - 1)
    expect(segunda.filas).toHaveLength(FILAS_POR_PAGINA)
  })

  it("la última página trae solo lo que queda", async () => {
    montar({ movimientos: muchos })

    const { filas, total } = await traerKardex({ pagina: 3 })

    expect(filas).toHaveLength(10)
    expect(total).toBe(60)
  })

  it("una página más allá del final viene vacía pero con el total", async () => {
    montar({ movimientos: muchos })

    const { filas, total } = await traerKardex({ pagina: 99 })

    expect(filas).toHaveLength(0)
    expect(total).toBe(60)
  })

  /*
    El total cuenta todo lo que pasó el filtro, no lo que cabe en la
    página: es lo que le dice a la pantalla cuántas páginas hay.
  */
  it("el total refleja el filtro, no la página", async () => {
    montar()

    const { filas, total } = await traerKardex({ filtros: { tipo: "entrada" } })

    expect(filas).toHaveLength(2)
    expect(total).toBe(2)
  })

  it("trata una página inválida como la primera", async () => {
    montar({ movimientos: muchos })

    const primera = await traerKardex({ pagina: 1 })

    for (const pagina of [0, -5, "abc", null]) {
      const { filas } = await traerKardex({ pagina })

      expect(filas[0].id).toBe(primera.filas[0].id)
    }
  })
})

describe("cuando la base falla", () => {
  it("avisa en vez de devolver una tabla vacía", async () => {
    montar({
      fallarEn: { kardex: { message: "conexión perdida", code: "500" } },
    })

    await expect(traerKardex()).rejects.toThrow(/no se pudo cargar el kardex/i)
  })
})

describe("qué sale de la base y qué no", () => {
  /*
    El aislamiento entre ferreterías NO se prueba aquí: lo garantiza
    security_invoker sobre la vista, y el doble no ejecuta RLS. Una prueba
    en este archivo solo comprobaría que el doble hace lo que se le
    programó. La verificación real corre contra PostgreSQL, con una segunda
    empresa cargada.

    Lo que sí se puede comprobar aquí es lo otro: que la consulta pida solo
    las columnas que la pantalla necesita.
  */
  it("no trae identificadores que la pantalla no usa", async () => {
    montar()

    const { filas } = await traerKardex()

    expect(filas[0]).not.toHaveProperty("empresa_id")
    expect(filas[0]).not.toHaveProperty("usuario_id")
  })

  it("trae el nombre del usuario, no su identificador", async () => {
    montar()

    const { filas } = await traerKardex()

    expect(filas.find((f) => f.id === 3).usuario).toBe("Vendedor")
  })

  /*
    producto_id y venta_id sí viajan: el primero lo necesita el filtro por
    producto y el segundo distingue una venta de una salida cualquiera.
    Ninguno se muestra.
  */
  it("conserva las relaciones que la pantalla necesita para decidir", async () => {
    montar()

    const { filas } = await traerKardex()
    const venta = filas.find((f) => f.id === 3)

    expect(venta.producto_id).toBe("p1")
    expect(venta.venta_id).toBe("v1")
  })
})
