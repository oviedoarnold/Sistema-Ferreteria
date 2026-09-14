import { supabase } from "../supabase"

/*
  Acceso a facturas y abonos.

  La factura guarda su propia copia de los datos fiscales y del nombre de
  cada producto: lo emitido no puede cambiar porque después se renueve el
  CAI o se corrija el catálogo.
*/

const COLUMNAS_VENTA = `
  *,
  detalle_venta (*),
  abonos (*)
`

function fallo(error, queHacia) {
  console.error(`No se pudo ${queHacia}:`, error)

  throw new Error(`No se pudo ${queHacia}.`)
}

const aFechaLocal = (iso) =>
  new Date(iso).toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

const aRenglonDeApp = (fila) => ({
  productId: fila.producto_id,
  id: fila.producto_id,
  code: fila.codigo || "",
  name: fila.nombre,
  category: "",
  qty: Number(fila.cantidad),
  quantity: Number(fila.cantidad),
  price: Number(fila.precio),
  subtotal: Number(fila.subtotal),
})

const aAbonoDeApp = (fila) => ({
  id: fila.id,
  amount: Number(fila.monto),
  date: aFechaLocal(fila.fecha),
  isoDate: fila.fecha,
  timestamp: new Date(fila.fecha).getTime(),
  note: fila.nota || "",
})

export function aVentaDeApp(fila, empresa) {
  const nombreCliente = fila.nombre_cliente || "Consumidor Final"

  return {
    id: fila.id,
    invoiceNumber: fila.numero_factura,
    correlativo: Number(fila.correlativo),

    date: aFechaLocal(fila.fecha),
    isoDate: fila.fecha,
    timestamp: new Date(fila.fecha).getTime(),

    clientId: fila.cliente_id,
    clientName: nombreCliente,
    customerName: nombreCliente,
    customer: nombreCliente,
    rtn: fila.rtn_comprador || "",

    items: (fila.detalle_venta || []).map(aRenglonDeApp),
    payments: (fila.abonos || [])
      .map(aAbonoDeApp)
      .sort((a, b) => a.timestamp - b.timestamp),

    subtotal: Number(fila.subtotal),
    tax: Number(fila.isv),
    taxRate: Number(fila.tasa_isv),
    total: Number(fila.total),

    paymentType: fila.forma_pago,
    type: fila.forma_pago,
    dueDate: fila.fecha_vencimiento,
    status: fila.estado,
    note: fila.nota || "",

    fiscal: {
      cai: fila.cai_emision || "",
      rangoDesde: fila.rango_desde_emision ?? "",
      rangoHasta: fila.rango_hasta_emision ?? "",
      fechaLimiteEmision: fila.fecha_limite_emision_emision || "",
      correlativo: Number(fila.correlativo),
      numero: fila.numero_factura,
    },

    company: {
      name: empresa?.name || "",
      address: empresa?.address || "",
      phone: empresa?.phone || "",
      currency: empresa?.currency || "L",
      taxRate: Number(fila.tasa_isv),
    },
  }
}

/*
  Devuelve las filas tal como vienen. Darles la forma que espera la
  pantalla necesita los datos de la empresa, y ese es un dato de
  presentación: mezclarlo aquí obligaría a recargar el historial completo
  cada vez que cambia el encabezado de la factura.
*/
export async function traerVentas() {
  const { data, error } = await supabase
    .from("ventas")
    .select(COLUMNAS_VENTA)
    .order("fecha", { ascending: false })

  if (error) fallo(error, "cargar el historial de facturas")

  return data || []
}

export const conFormaDeApp = (filas, empresa) =>
  filas
    .map((fila) => aVentaDeApp(fila, empresa))
    .sort((a, b) => b.timestamp - a.timestamp)

export async function pedirCorrelativo(tipo) {
  const { data, error } = await supabase.rpc("siguiente_correlativo", {
    p_tipo: tipo,
  })

  if (error) fallo(error, "obtener el número de documento")

  return Number(data)
}

/*
  Emite la factura completa en una sola llamada.

  Antes eran cinco viajes de red sin transacción: correlativo, cabecera,
  detalle, movimientos, y un borrado compensatorio si algo fallaba. Entre
  el detalle y los movimientos cabía el peor de los fallos: factura
  emitida con el inventario sin descargar, sin aviso para nadie.

  Ahora lo resuelve crear_venta_atomica en la base. Lo que queda aquí es
  traducir el carrito a lo que la función espera y traducir sus errores a
  algo que el cajero entienda.

  La empresa y el usuario no se envían: la función los deriva de la sesión.
  Los totales tampoco: los recalcula ella. Lo que no viaja no se puede
  manipular.
*/
const MENSAJES_DE_LA_BASE = {
  P0001: "Revisa los datos de la venta.",
  P0002: "Uno de los productos o el cliente ya no está disponible.",
  P0003: "No hay existencias suficientes.",
  28000: "Tu sesión expiró. Vuelve a entrar.",
}

function fallaAlVender(error) {
  console.error("No se pudo registrar la venta:", error)

  /*
    La función manda el motivo real en el mensaje —qué producto y cuántas
    unidades quedan—, así que se prefiere ese texto sobre el genérico.
  */
  const texto = String(error?.message || "").trim()

  if (texto) throw new Error(texto)

  throw new Error(
    MENSAJES_DE_LA_BASE[error?.code] || "No se pudo registrar la venta."
  )
}

export async function crearVenta(venta, { clave = null } = {}) {
  const { data, error } = await supabase.rpc("crear_venta_atomica", {
    p_items: venta.items.map((item) => ({
      producto_id: item.productId,
      cantidad: item.qty,
      precio: item.price,
    })),
    p_forma_pago: venta.paymentType,
    p_tasa_isv: venta.taxRate,
    p_clave_idempotencia: clave,
    p_cliente_id: venta.clientId || null,
    p_nombre_cliente: venta.customerName || "Consumidor Final",
    p_rtn_comprador: venta.rtn || "",
    p_fecha_vencimiento:
      venta.paymentType === "credito" ? venta.dueDate || null : null,
    p_nota: venta.note || "",
  })

  if (error) fallaAlVender(error)

  return data
}

/*
  Anula una factura emitida.

  Una factura no se borra: el correlativo pertenece a una numeración
  autorizada que debe ser continua, así que el documento se conserva y pasa
  a decir que está anulado. La base devuelve la mercadería con movimientos
  compensatorios y deja constancia de quién, cuándo y por qué.

  Igual que al emitir, aquí no se toca el inventario ni el estado por
  separado: todo ocurre dentro de la RPC, en una sola transacción.
*/
const MENSAJES_AL_ANULAR = {
  28000: "Tu sesión expiró. Vuelve a entrar.",
  42501: "Solo un administrador puede anular una factura.",
  P0001: "Explica el motivo de la anulación.",
  P0002: "La factura ya no está disponible.",
  VA001: "Esta factura ya estaba anulada.",
  VA002: "Esta factura tiene abonos registrados.",
}

export async function anularVenta(ventaId, motivo) {
  const { error } = await supabase.rpc("anular_venta", {
    p_venta_id: ventaId,
    p_motivo: motivo,
  })

  if (!error) return

  console.error("No se pudo anular la factura:", error)

  /*
    La función explica el caso concreto —cuántos abonos, de qué monto, qué
    factura—, así que ese texto le sirve más al usuario que el genérico.
  */
  const texto = String(error.message || "").trim()

  throw new Error(
    texto || MENSAJES_AL_ANULAR[error.code] || "No se pudo anular la factura."
  )
}

// ── ABONOS ─────────────────────────────────────────────────

async function abonoConClave(clave, empresaId) {
  if (!clave) return null

  const { data } = await supabase
    .from("abonos")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("clave_idempotencia", clave)
    .maybeSingle()

  return data || null
}

export async function crearAbono(
  ventaId,
  { amount, note },
  { empresaId, usuarioId, clave = null }
) {
  const yaRegistrado = await abonoConClave(clave, empresaId)

  if (yaRegistrado) return aAbonoDeApp(yaRegistrado)

  const { data, error } = await supabase
    .from("abonos")
    .insert({
      empresa_id: empresaId,
      venta_id: ventaId,
      usuario_id: usuarioId || null,
      monto: amount,
      nota: note || "",
      clave_idempotencia: clave,
    })
    .select("*")
    .single()

  if (error?.code === "23505" && clave) {
    const registradoPorOtroIntento = await abonoConClave(clave, empresaId)

    if (registradoPorOtroIntento) return aAbonoDeApp(registradoPorOtroIntento)
  }

  if (error) fallo(error, "registrar el abono")

  return aAbonoDeApp(data)
}

export async function eliminarAbono(abonoId) {
  const { error } = await supabase.from("abonos").delete().eq("id", abonoId)

  if (error) fallo(error, "eliminar el abono")
}

/*
  El estado de la factura lo decide el saldo, no el usuario. Se recalcula
  después de cada abono para que "cancelada" nunca dependa de que la
  pantalla se acuerde de actualizarlo.
*/
export async function ajustarEstadoPorSaldo(ventaId, saldoPendiente) {
  const { error } = await supabase
    .from("ventas")
    .update({ estado: saldoPendiente <= 0 ? "pagada" : "pendiente" })
    .eq("id", ventaId)

  if (error) fallo(error, "actualizar el estado de la factura")
}
