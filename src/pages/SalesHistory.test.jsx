import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, fireEvent, within, waitFor } from "@testing-library/react"
import Swal from "sweetalert2"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import SalesProvider from "../context/SalesContext"
import { EMPRESA_PRUEBA, renderizarPantalla } from "../test/pantallas"
import SalesHistory from "./SalesHistory"

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

const empresa = { name: EMPRESA_PRUEBA.nombre, currency: "L", taxRate: 15 }

const factura = (extra = {}) => ({
  id: "F-1",
  invoiceNumber: "FAC-01001",
  date: "20/08/2026",
  timestamp: Date.now(),
  clientName: "Ferremax",
  rtn: "0801199912345",
  items: [
    { productId: "p1", name: "Martillo", qty: 1, quantity: 1, price: 180, subtotal: 180 },
  ],
  subtotal: 180,
  tax: 27,
  total: 207,
  paymentType: "contado",
  type: "contado",
  status: "pagada",
  company: empresa,
  ...extra,
})

const aCredito = (extra = {}) =>
  factura({
    id: "F-2",
    invoiceNumber: "FAC-01002",
    clientName: "Constructora López",
    paymentType: "credito",
    type: "credito",
    status: "pendiente",
    total: 1000,
    dueDate: "2027-01-31",
    ...extra,
  })

const anulada = (extra = {}) =>
  factura({
    id: "F-3",
    invoiceNumber: "FAC-01003",
    clientName: "Distribuidora Sur",
    status: "anulada",
    total: 500,
    voidReason: "se facturó el producto equivocado",
    voidedAt: new Date().toISOString(),
    ...extra,
  })

function renderHistory(ventas = [], opciones = {}) {
  return renderizarPantalla(
    <AuthProvider>
      <ProductProvider>
        <SalesProvider>
          <SalesHistory />
        </SalesProvider>
      </ProductProvider>
    </AuthProvider>,
    { ventas, esperar: ["ventas"], ...opciones }
  )
}

const filaDe = (numero) =>
  screen.getByText(numero, { exact: false }).closest(".sale-card")

describe("SalesHistory sin ventas", () => {
  it("invita a generar la primera factura", async () => {
    await renderHistory()
    expect(screen.getByText(/no hay facturas registradas/i)).toBeInTheDocument()
  })
})

describe("SalesHistory con ventas", () => {
  it("lista las facturas", async () => {
    await renderHistory([factura(), aCredito()])

    expect(screen.getByText("Ferremax")).toBeInTheDocument()
    expect(screen.getByText("Constructora López")).toBeInTheDocument()
  })

  it("cuenta las facturas registradas", async () => {
    await renderHistory([factura(), aCredito()])

    const tarjeta = screen.getByText("Facturas").closest(".stat-card")

    expect(tarjeta).toHaveTextContent("2")
  })

  it("separa las ventas de contado de las de crédito", async () => {
    await renderHistory([factura(), aCredito()])

    expect(
      screen.getByText("Ventas contado").closest(".stat-card")
    ).toHaveTextContent("1")

    expect(
      screen.getByText("Ventas crédito").closest(".stat-card")
    ).toHaveTextContent("1")
  })

  it("suma el total facturado", async () => {
    await renderHistory([factura(), aCredito()])
    expect(screen.getByText("L 1,207.00")).toBeInTheDocument()
  })

  it("muestra el saldo por cobrar solo de lo pendiente", async () => {
    await renderHistory([factura(), aCredito()])

    const resumen = screen
      .getByText("Saldo por cobrar")
      .closest("div")

    expect(resumen).toHaveTextContent("L 1,000.00")
  })

  it("marca pagada la venta de contado", async () => {
    await renderHistory([factura()])
    expect(within(filaDe("FAC-01001")).getByText("Pagada")).toBeInTheDocument()
  })

  it("marca pendiente la venta a crédito", async () => {
    await renderHistory([aCredito()])
    expect(within(filaDe("FAC-01002")).getByText("Pendiente")).toBeInTheDocument()
  })

  it("marca vencida la que pasó su fecha de pago", async () => {
    await renderHistory([aCredito({ dueDate: "2020-01-01" })])
    expect(within(filaDe("FAC-01002")).getByText("Vencida")).toBeInTheDocument()
  })

  it("marca cancelada la venta a crédito ya saldada", async () => {
    await renderHistory([
      aCredito({ status: "pagada", payments: [{ id: "a1", amount: 1000 }] }),
    ])

    expect(
      within(filaDe("FAC-01002")).getByText("Cancelada")
    ).toBeInTheDocument()
  })
})

describe("SalesHistory: abonos", () => {
  it("ofrece abonar solo en las facturas a crédito con saldo", async () => {
    await renderHistory([factura(), aCredito()])

    expect(
      within(filaDe("FAC-01002")).getByRole("button", { name: /abonar/i })
    ).toBeInTheDocument()

    expect(
      within(filaDe("FAC-01001")).queryByRole("button", { name: /abonar/i })
    ).not.toBeInTheDocument()
  })

  it("muestra lo abonado y lo que resta", async () => {
    await renderHistory([aCredito({ payments: [{ id: "a1", amount: 400 }] })])

    const fila = filaDe("FAC-01002")

    expect(fila).toHaveTextContent("Abonado")
    expect(fila).toHaveTextContent("Resta")
  })

  it("abre el modal de abonos con el saldo actual", async () => {
    await renderHistory([aCredito({ payments: [{ id: "a1", amount: 400 }] })])

    fireEvent.click(
      within(filaDe("FAC-01002")).getByRole("button", { name: /abonar/i })
    )

    expect(screen.getByText(/abonar a/i)).toBeInTheDocument()
    expect(screen.getByText("Saldo")).toBeInTheDocument()
  })

  it("el monto no permite superar el saldo pendiente", async () => {
    await renderHistory([aCredito()])

    fireEvent.click(screen.getByRole("button", { name: /abonar/i }))

    expect(screen.getByPlaceholderText("0.00")).toHaveAttribute("max", "1000")
  })

  it("lista los abonos ya registrados", async () => {
    await renderHistory([
      aCredito({
        payments: [
          { id: "a1", amount: 400, date: "22/08/2026", note: "Efectivo" },
        ],
      }),
    ])

    fireEvent.click(screen.getByRole("button", { name: /abonar/i }))

    expect(screen.getByText(/abonos registrados/i)).toBeInTheDocument()
    expect(screen.getByText(/efectivo/i)).toBeInTheDocument()
  })
})

describe("SalesHistory: filtros", () => {
  it("busca por nombre de cliente", async () => {
    await renderHistory([factura(), aCredito()])

    fireEvent.change(screen.getByPlaceholderText(/buscar por cliente/i), {
      target: { value: "ferremax" },
    })

    expect(screen.getByText("Ferremax")).toBeInTheDocument()
    expect(screen.queryByText("Constructora López")).not.toBeInTheDocument()
  })

  it("busca por número de factura", async () => {
    await renderHistory([factura(), aCredito()])

    fireEvent.change(screen.getByPlaceholderText(/buscar por cliente/i), {
      target: { value: "FAC-01002" },
    })

    expect(screen.getByText("Constructora López")).toBeInTheDocument()
    expect(screen.queryByText("Ferremax")).not.toBeInTheDocument()
  })

  it("filtra por forma de pago", async () => {
    await renderHistory([factura(), aCredito()])

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "credito" },
    })

    expect(screen.getByText("Constructora López")).toBeInTheDocument()
    expect(screen.queryByText("Ferremax")).not.toBeInTheDocument()
  })

  it("avisa cuando el filtro no deja resultados", async () => {
    await renderHistory([factura()])

    fireEvent.change(screen.getByPlaceholderText(/buscar por cliente/i), {
      target: { value: "cliente-inexistente" },
    })

    expect(screen.getByText(/no se encontraron facturas/i)).toBeInTheDocument()
  })
})

describe("facturas anuladas en el historial", () => {
  /*
    Una anulada que desapareciera del historial sería indistinguible de una
    borrada, que es justo lo que el sistema dejó de permitir.
  */
  it("sigue mostrando la factura anulada", async () => {
    await renderHistory([factura(), anulada()])

    expect(screen.getByText("Distribuidora Sur")).toBeInTheDocument()
    expect(screen.getByText("FAC-01003", { exact: false })).toBeInTheDocument()
  })

  it("la marca como anulada y no como pendiente", async () => {
    await renderHistory([anulada()])

    const fila = filaDe("FAC-01003")

    expect(within(fila).getByText("Anulada")).toBeInTheDocument()
    expect(within(fila).queryByText("Pendiente")).not.toBeInTheDocument()
  })

  it("no la suma al total facturado", async () => {
    await renderHistory([factura(), anulada()])

    const total = screen
      .getByText("Total facturado")
      .parentElement

    expect(total).toHaveTextContent("L 207.00")
    expect(total).not.toHaveTextContent("L 707.00")
  })

  it("no la cuenta entre las ventas de contado", async () => {
    await renderHistory([factura(), anulada()])

    expect(
      screen.getByText("Ventas contado").closest(".stat-card")
    ).toHaveTextContent("1")
  })

  /*
    Anular una factura a crédito borra la deuda: el cliente ya no debe ese
    dinero porque la venta dejó de existir como venta.
  */
  it("la saca de las cuentas por cobrar", async () => {
    await renderHistory([
      aCredito({ total: 1000 }),
      anulada({
        paymentType: "credito",
        type: "credito",
        total: 500,
        dueDate: "2027-01-31",
      }),
    ])

    const porCobrar = screen
      .getByText("Saldo por cobrar")
      .parentElement

    expect(porCobrar).toHaveTextContent("L 1,000.00")
    expect(porCobrar).not.toHaveTextContent("L 1,500.00")
  })

  /*
    El motivo viaja desde la columna motivo_anulacion hasta la factura
    impresa. Sin esta prueba, el mapeo podía romperse y el documento salir
    marcado como anulado pero sin decir por qué.
  */
  it("imprime el motivo guardado en la factura", async () => {
    await renderHistory([anulada()])

    fireEvent.click(
      within(filaDe("FAC-01003")).getByText("Ver factura")
    )

    expect(
      screen.getByText("se facturó el producto equivocado")
    ).toBeInTheDocument()
  })

  it("no ofrece abonar sobre una anulada", async () => {
    await renderHistory([
      anulada({
        paymentType: "credito",
        type: "credito",
        dueDate: "2027-01-31",
      }),
    ])

    const fila = filaDe("FAC-01003")

    expect(within(fila).queryByText("Abonar")).not.toBeInTheDocument()
  })
})

/*
  El doble de SweetAlert responde "descartado" por omisión, que es lo que
  pasa cuando nadie pulsa nada. Para recorrer el flujo completo hay que
  decirle qué contestó el administrador.
*/
const responderConMotivo = (motivo) =>
  Swal.fire.mockResolvedValueOnce({
    isConfirmed: true,
    value: motivo,
  })

const anular = (numero) =>
  fireEvent.click(within(filaDe(numero)).getByText("Anular"))

describe("anular desde el historial", () => {
  beforeEach(() => {
    Swal.fire.mockClear()
  })

  it("pide el motivo antes de anular", async () => {
    const { falso } = await renderHistory([factura()])

    anular("FAC-01001")

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())

    const dialogo = Swal.fire.mock.calls[0][0]

    expect(dialogo.input).toBe("textarea")
    expect(dialogo.title).toContain("FAC-01001")
    expect(falso.rpc).not.toHaveBeenCalledWith(
      "anular_venta",
      expect.anything()
    )
  })

  /*
    La misma regla que aplica la base, para que el administrador se entere
    antes de mandar la petición y no después.
  */
  it("no acepta un motivo de menos de cinco caracteres", async () => {
    await renderHistory([factura()])

    anular("FAC-01001")

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())

    const { inputValidator } = Swal.fire.mock.calls[0][0]

    expect(inputValidator("err")).toMatch(/5 caracteres/i)
    expect(inputValidator("   ")).toMatch(/motivo/i)
    expect(inputValidator("se facturó de más")).toBeUndefined()
  })

  it("no hace nada si el administrador cancela", async () => {
    const { falso } = await renderHistory([factura()])

    anular("FAC-01001")

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())

    expect(falso.rpc).not.toHaveBeenCalledWith(
      "anular_venta",
      expect.anything()
    )
    expect(falso.datos.ventas[0].estado).toBe("pagada")
  })

  it("anula la factura con el motivo escrito", async () => {
    const { falso } = await renderHistory([factura()])

    responderConMotivo("  se facturó el producto equivocado  ")
    anular("FAC-01001")

    await waitFor(() =>
      expect(falso.datos.ventas[0].estado).toBe("anulada")
    )

    // El motivo viaja sin los espacios de sobra.
    expect(falso.datos.ventas[0].motivo_anulacion).toBe(
      "se facturó el producto equivocado"
    )
  })

  it("devuelve la mercadería al inventario", async () => {
    const { falso } = await renderHistory([factura()])

    responderConMotivo("se facturó el producto equivocado")
    anular("FAC-01001")

    await waitFor(() =>
      expect(
        falso.datos.movimientos_inventario.filter(
          (m) => m.tipo === "devolucion"
        )
      ).toHaveLength(1)
    )
  })

  it("deja la factura marcada como anulada en la pantalla", async () => {
    await renderHistory([factura()])

    responderConMotivo("se facturó el producto equivocado")
    anular("FAC-01001")

    await waitFor(() =>
      expect(
        within(filaDe("FAC-01001")).getByText("Anulada")
      ).toBeInTheDocument()
    )
  })

  /*
    Cuando la base rechaza —por abonos, por ejemplo— el usuario tiene que
    leer el motivo real, que dice cuántos son y qué hacer, no un mensaje
    genérico.
  */
  it("muestra el motivo del rechazo tal como lo manda la base", async () => {
    const conAbonos = aCredito({
      payments: [
        { id: "ab1", amount: 300, timestamp: Date.now(), note: "" },
      ],
    })

    const { falso } = await renderHistory([conAbonos])

    responderConMotivo("el cliente devolvió todo")
    anular("FAC-01002")

    await waitFor(() =>
      expect(
        Swal.fire.mock.calls.some(
          ([opciones]) =>
            opciones.icon === "error" &&
            /abono/i.test(opciones.text || "")
        )
      ).toBe(true)
    )

    expect(falso.datos.ventas[0].estado).toBe("pendiente")
  })

  it("avisa cuando la anulación salió bien", async () => {
    await renderHistory([factura()])

    responderConMotivo("se facturó el producto equivocado")
    anular("FAC-01001")

    await waitFor(() =>
      expect(
        Swal.fire.mock.calls.some(
          ([opciones]) =>
            opciones.icon === "success" &&
            /anulada/i.test(opciones.title || "")
        )
      ).toBe(true)
    )
  })
})

describe("el botón de anular", () => {
  it("se lo ofrece al administrador", async () => {
    await renderHistory([factura()])

    expect(within(filaDe("FAC-01001")).getByText("Anular")).toBeInTheDocument()
  })

  /*
    Ocultarlo es cortesía: la base rechaza igual a un vendedor que llame
    directamente. Lo que se comprueba aquí es que no se le proponga algo
    que no va a poder hacer.
  */
  it("no se lo ofrece a un vendedor", async () => {
    await renderHistory([factura()], { rol: "vendedor" })

    expect(within(filaDe("FAC-01001")).queryByText("Anular")).not
      .toBeInTheDocument()
  })

  it("no lo ofrece sobre una que ya está anulada", async () => {
    await renderHistory([anulada()])

    expect(within(filaDe("FAC-01003")).queryByText("Anular")).not
      .toBeInTheDocument()
  })
})
