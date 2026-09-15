import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import { renderizarPantalla } from "../test/pantallas"
import Kardex from "./Kardex"

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const PRODUCTOS = [
  { id: "p1", code: "HER-001", name: "Martillo", category: "Herramientas", price: 180, stock: 0 },
  { id: "p2", code: "CEM-001", name: "Cemento", category: "Construcción", price: 250, stock: 0 },
]

const dia = (n) => `2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z`

/*
  El libro cubre los cuatro tipos y las dos formas de relación con una
  venta, que es lo que la pantalla tiene que saber distinguir.
*/
const MOVIMIENTOS = [
  { id: 1, producto_id: "p1", tipo: "entrada", cantidad: 20, motivo: "Existencia inicial", fecha: dia(1) },
  { id: 2, producto_id: "p2", tipo: "entrada", cantidad: 50, motivo: "Compra a proveedor", fecha: dia(2) },
  { id: 3, producto_id: "p1", venta_id: "v1", tipo: "salida", cantidad: -3, motivo: "Venta al contado", fecha: dia(3) },
  { id: 4, producto_id: "p1", tipo: "ajuste", cantidad: 10, motivo: "Ajuste manual desde inventario", fecha: dia(5) },
  { id: 5, producto_id: "p1", venta_id: "v1", tipo: "devolucion", cantidad: 3, motivo: "Factura anulada", fecha: dia(6) },
  { id: 6, producto_id: "p2", tipo: "salida", cantidad: -5, motivo: "Merma por bodega", fecha: dia(7) },
]

const VENTAS = [
  { id: "v1", invoiceNumber: "FAC-01210", correlativo: 1210, total: 345 },
]

async function renderKardex({
  movimientos = MOVIMIENTOS,
  productos = PRODUCTOS,
  direccion = "/kardex",
  fallarEn,
} = {}) {
  const resultado = await renderizarPantalla(
    <MemoryRouter initialEntries={[direccion]}>
      <AuthProvider>
        <ProductProvider>
          <Kardex />
        </ProductProvider>
      </AuthProvider>
    </MemoryRouter>,
    { productos, movimientos, ventas: VENTAS, esperar: ["kardex"], fallarEn }
  )

  return resultado
}

const filaDe = (texto) =>
  screen.getByText(texto, { exact: false }).closest("tr")

const filasDeLaTabla = () =>
  screen.getAllByRole("row").slice(1)

/*
  Los nombres de producto aparecen dos veces en la pantalla: en la tabla y
  como opciones del filtro. Comprobar la ausencia sobre el documento entero
  daria siempre falso.
*/
const laTabla = () => screen.getByRole("table")

describe("Kardex: carga inicial", () => {
  it("muestra los movimientos del libro", async () => {
    await renderKardex()

    expect(screen.getByText("Kardex de Inventario")).toBeInTheDocument()
    expect(filasDeLaTabla()).toHaveLength(6)
  })

  it("muestra fecha, producto, código, motivo y usuario", async () => {
    await renderKardex()

    const fila = filaDe("Existencia inicial")

    expect(within(fila).getByText("Martillo")).toBeInTheDocument()
    expect(within(fila).getByText("HER-001")).toBeInTheDocument()
    expect(within(fila).getByText("Administradora")).toBeInTheDocument()
  })

  it("avisa cuando el libro está vacío", async () => {
    await renderKardex({ movimientos: [] })

    expect(
      screen.getByText(/todavía no hay movimientos registrados/i)
    ).toBeInTheDocument()
  })
})

describe("Kardex: cómo se lee cada movimiento", () => {
  it("una entrada se muestra como Entrada, en la columna de entradas", async () => {
    await renderKardex()

    const fila = filaDe("Existencia inicial")
    const celdas = within(fila).getAllByRole("cell")

    expect(within(fila).getByText("Entrada")).toBeInTheDocument()
    expect(celdas[5]).toHaveTextContent("20")
    expect(celdas[6]).toHaveTextContent("—")
  })

  it("una salida con factura se muestra como Venta y trae el documento", async () => {
    await renderKardex()

    const fila = filaDe("Venta al contado")
    const celdas = within(fila).getAllByRole("cell")

    expect(within(fila).getByText("Venta")).toBeInTheDocument()
    expect(celdas[3]).toHaveTextContent("FAC-01210")
    expect(celdas[5]).toHaveTextContent("—")
    expect(celdas[6]).toHaveTextContent("3")
  })

  it("una salida sin factura se muestra como Salida y sin documento", async () => {
    await renderKardex()

    const fila = filaDe("Merma por bodega")
    const celdas = within(fila).getAllByRole("cell")

    expect(within(fila).getByText("Salida")).toBeInTheDocument()
    expect(celdas[3]).toHaveTextContent("—")
  })

  it("un ajuste positivo cae en la columna de entradas", async () => {
    await renderKardex()

    const fila = filaDe("Ajuste manual")
    const celdas = within(fila).getAllByRole("cell")

    expect(within(fila).getByText("Ajuste")).toBeInTheDocument()
    expect(celdas[5]).toHaveTextContent("10")
  })

  /*
    El valor del Kardex: la venta y su anulación son dos hechos separados,
    y el original no desaparece.
  */
  it("la anulación aparece aparte de la venta que deshace", async () => {
    await renderKardex()

    const anulacion = filaDe("Factura anulada")

    expect(within(anulacion).getByText("Anulación")).toBeInTheDocument()
    expect(within(anulacion).getAllByRole("cell")[5]).toHaveTextContent("3")
    expect(within(anulacion).getAllByRole("cell")[3]).toHaveTextContent("FAC-01210")

    // La salida original sigue en el libro, aparte.
    const venta = filaDe("Venta al contado")

    expect(within(venta).getAllByRole("cell")[6]).toHaveTextContent("3")
  })

  it("lleva el saldo del producto después de cada movimiento", async () => {
    await renderKardex()

    const saldoDe = (motivo) =>
      within(filaDe(motivo)).getAllByRole("cell")[7].textContent

    expect(saldoDe("Factura anulada")).toBe("30")
    expect(saldoDe("Ajuste manual")).toBe("27")
    expect(saldoDe("Venta al contado")).toBe("17")
  })
})

describe("Kardex: cuando falta un dato", () => {
  /*
    El nombre del usuario lo resuelve nombre_de_usuario(), que devuelve NULL
    para alguien de otra empresa. Y un movimiento puede no tener motivo. La
    tabla tiene que seguir siendo legible: un guion, no una celda vacía ni
    "undefined".
  */
  it("pone un guion donde no hay usuario, motivo ni código", async () => {
    await renderKardex({
      productos: [{ id: "p1", code: "", name: "Martillo", category: "", price: 1, stock: 0 }],
      movimientos: [
        {
          id: 1,
          producto_id: "p1",
          usuario_id: null,
          tipo: "entrada",
          cantidad: 5,
          motivo: "",
          fecha: dia(1),
        },
      ],
    })

    const celdas = within(laTabla()).getAllByRole("cell")

    expect(celdas[1]).toHaveTextContent("Martillo")
    expect(celdas[3]).toHaveTextContent("—") // documento
    expect(celdas[4]).toHaveTextContent("—") // motivo
    expect(celdas[8]).toHaveTextContent("—") // usuario
  })
})

describe("Kardex: filtros", () => {
  const escribirBusqueda = (texto) =>
    fireEvent.change(screen.getByPlaceholderText(/buscar por producto/i), {
      target: { value: texto },
    })

  it("busca por nombre de producto", async () => {
    await renderKardex()

    escribirBusqueda("cemento")

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))
    expect(within(laTabla()).queryByText("Martillo")).not.toBeInTheDocument()
    expect(within(laTabla()).getAllByText("Cemento")).toHaveLength(2)
  })

  it("busca por código", async () => {
    await renderKardex()

    escribirBusqueda("HER-001")

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(4))
  })

  it("filtra por producto", async () => {
    await renderKardex()

    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "p2" },
    })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))
  })

  it("filtra por tipo de movimiento", async () => {
    await renderKardex()

    fireEvent.change(screen.getByLabelText("Tipo de movimiento"), {
      target: { value: "entrada" },
    })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))
  })

  it("filtra desde una fecha", async () => {
    await renderKardex()

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-09-05" },
    })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(3))
  })

  /*
    "Hasta el 3" incluye el día 3 entero. Si el límite se calculara mal, el
    movimiento de ese día —registrado a las 10 de la mañana— se perdería.
  */
  it("filtra hasta una fecha sin perder ese día", async () => {
    await renderKardex()

    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-09-03" },
    })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(3))
    expect(filaDe("Venta al contado")).toBeInTheDocument()
  })

  it("avisa cuando ningún movimiento coincide", async () => {
    await renderKardex()

    escribirBusqueda("taladro")

    await waitFor(() =>
      expect(
        screen.getByText(/ningún movimiento coincide con el filtro/i)
      ).toBeInTheDocument()
    )
  })

  it("limpia todos los filtros de una vez", async () => {
    await renderKardex()

    escribirBusqueda("cemento")

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))

    fireEvent.click(screen.getByText("Limpiar"))

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(6))
  })

  it("no ofrece limpiar cuando no hay ningún filtro puesto", async () => {
    await renderKardex()

    expect(screen.queryByText("Limpiar")).not.toBeInTheDocument()
  })
})

describe("Kardex: producto preseleccionado desde el inventario", () => {
  it("abre filtrado por el producto de la dirección", async () => {
    await renderKardex({ direccion: "/kardex?producto=p2" })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))

    expect(screen.getByLabelText("Producto")).toHaveValue("p2")
    expect(within(laTabla()).queryByText("Martillo")).not.toBeInTheDocument()
  })

  /*
    El parámetro solo siembra el valor inicial. Si la pantalla lo volviera a
    leer, quitar el filtro sería imposible.
  */
  it("deja quitar ese filtro después", async () => {
    await renderKardex({ direccion: "/kardex?producto=p2" })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(2))

    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "" },
    })

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(6))
  })
})

describe("Kardex: paginación", () => {
  const muchos = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    producto_id: "p1",
    usuario_id: "u-prueba",
    tipo: "entrada",
    cantidad: 1,
    motivo: `Carga ${i + 1}`,
    fecha: dia(1),
  }))

  it("parte con 25 filas y dice cuántas páginas hay", async () => {
    await renderKardex({ movimientos: muchos })

    expect(filasDeLaTabla()).toHaveLength(25)
    expect(screen.getByText(/página 1 de 2/i)).toBeInTheDocument()
    expect(screen.getByText(/30 movimientos/i)).toBeInTheDocument()
  })

  it("avanza a la siguiente página", async () => {
    await renderKardex({ movimientos: muchos })

    fireEvent.click(screen.getByText("Siguiente"))

    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(5))
    expect(screen.getByText(/página 2 de 2/i)).toBeInTheDocument()
  })

  it("vuelve a la anterior", async () => {
    await renderKardex({ movimientos: muchos })

    fireEvent.click(screen.getByText("Siguiente"))
    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(5))

    fireEvent.click(screen.getByText("Anterior"))
    await waitFor(() => expect(filasDeLaTabla()).toHaveLength(25))
  })

  it("no deja retroceder desde la primera ni avanzar desde la última", async () => {
    await renderKardex({ movimientos: muchos })

    expect(screen.getByText("Anterior")).toBeDisabled()
    expect(screen.getByText("Siguiente")).not.toBeDisabled()

    fireEvent.click(screen.getByText("Siguiente"))

    await waitFor(() => expect(screen.getByText("Siguiente")).toBeDisabled())
    expect(screen.getByText("Anterior")).not.toBeDisabled()
  })

  /*
    Quedarse en la página dos de un resultado que ahora tiene una sola deja
    la pantalla en blanco sin explicación.
  */
  it("vuelve a la primera página al cambiar un filtro", async () => {
    await renderKardex({ movimientos: muchos })

    fireEvent.click(screen.getByText("Siguiente"))
    await waitFor(() => expect(screen.getByText(/página 2 de 2/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText("Tipo de movimiento"), {
      target: { value: "entrada" },
    })

    await waitFor(() =>
      expect(screen.getByText(/página 1 de 2/i)).toBeInTheDocument()
    )
  })

  it("no muestra paginación cuando todo cabe en una página", async () => {
    await renderKardex()

    expect(screen.getByText(/página 1 de 1/i)).toBeInTheDocument()
    expect(screen.getByText("Anterior")).toBeDisabled()
    expect(screen.getByText("Siguiente")).toBeDisabled()
  })
})

describe("Kardex: cuando la base falla", () => {
  it("lo dice en vez de mostrar una tabla vacía", async () => {
    await renderKardex({
      fallarEn: { kardex: { message: "conexión perdida", code: "500" } },
    })

    expect(
      screen.getByText("No se pudo cargar el kardex.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("no se queda diciendo que carga", async () => {
    await renderKardex({
      fallarEn: { kardex: { message: "conexión perdida", code: "500" } },
    })

    expect(screen.queryByText(/cargando movimientos/i)).not.toBeInTheDocument()
  })
})
