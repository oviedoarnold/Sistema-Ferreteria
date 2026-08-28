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
  así que nunca arrastra saldo.
*/
export function getSaleBalance(sale) {
  if (!isCreditSale(sale)) {
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
