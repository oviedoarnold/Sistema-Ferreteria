/*
  Cálculos de saldo y abonos de una
  venta. Viven fuera del contexto para
  que las páginas y la plantilla de
  factura los usen sin importar React.
*/

/*
  Los montos se redondean a centavos
  para que la comparación contra cero
  no falle por el error de punto
  flotante.
*/
export function roundMoney(value) {
  return (
    Math.round(
      Number(value || 0) * 100
    ) / 100
  )
}

/*
  Una factura anulada sigue existiendo y se
  sigue consultando: eso es el historial.
  Lo que no hace es contar como venta.

  El filtro vive aquí, en un solo lugar,
  porque las métricas se calculan en once
  puntos distintos entre el tablero y el
  historial, y repetirlo en cada uno es
  invitar a que el próximo reporte olvide
  alguno.
*/
export function esVentaAnulada(sale) {
  return sale?.status === "anulada"
}

export function esVentaVigente(sale) {
  return !esVentaAnulada(sale)
}

export function isCreditSale(sale) {
  const paymentType = (
    sale?.paymentType ||
    sale?.type ||
    "contado"
  ).toLowerCase()

  return paymentType === "credito"
}

export function getSalePayments(sale) {
  return Array.isArray(sale?.payments)
    ? sale.payments
    : []
}

export function getSalePaid(sale) {
  return roundMoney(
    getSalePayments(sale).reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    )
  )
}

/*
  Una venta de contado nace saldada,
  así que nunca arrastra saldo. Una
  anulada tampoco: dejó de ser una
  cuenta por cobrar.

  Va aquí y no en cada pantalla porque
  este es el punto por donde el saldo
  entra a toda la cobranza.
*/
export function getSaleBalance(sale) {
  if (!isCreditSale(sale) || esVentaAnulada(sale)) {
    return 0
  }

  const balance = roundMoney(
    Number(sale?.total || 0) -
      getSalePaid(sale)
  )

  return balance > 0 ? balance : 0
}

/*
  Devuelve la venta con la lista de
  abonos dada y el estado recalculado.
*/
export function applyPayments(
  sale,
  payments
) {
  const paid = roundMoney(
    payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    )
  )

  const balance = roundMoney(
    Number(sale.total || 0) - paid
  )

  return {
    ...sale,

    payments,

    status:
      balance <= 0
        ? "pagada"
        : "pendiente",
  }
}

/*
  La fecha de una venta se compara como fecha y no como texto: el formato
  de "date" depende del locale y basta un cambio de formato para que la
  comparación deje de calzar sin que nadie lo note.
*/
export function fechaDeVenta(sale) {
  const fecha = new Date(
    sale?.isoDate || sale?.timestamp || sale?.date
  )

  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function esVentaDelDia(sale, dia = new Date()) {
  const fecha = fechaDeVenta(sale)

  return Boolean(fecha) && fecha.toDateString() === dia.toDateString()
}

export function esVentaDelMes(sale, mes = new Date()) {
  const fecha = fechaDeVenta(sale)

  return (
    Boolean(fecha) &&
    fecha.getMonth() === mes.getMonth() &&
    fecha.getFullYear() === mes.getFullYear()
  )
}
