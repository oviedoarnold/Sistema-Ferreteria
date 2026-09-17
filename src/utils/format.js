const LOCALE = "es-HN"

export const MONEDA_POR_DEFECTO = "L"

/*
  Monto corto para un rótulo sin espacio: "L 1.8K", "L 12.6K". Es solo para
  leer de un vistazo; donde se usa, el monto exacto va en el nombre accesible
  y en el detalle al pasar el mouse.
*/
export function formatMoneyCompacto(value, currency = MONEDA_POR_DEFECTO) {
  const amount = Number(value)
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const absoluto = Math.abs(safeAmount)

  if (absoluto >= 999_950) return `${currency} ${(safeAmount / 1_000_000).toFixed(1)}M`
  if (absoluto >= 999.5) return `${currency} ${(safeAmount / 1_000).toFixed(1)}K`

  return `${currency} ${Math.round(safeAmount)}`
}

export function formatMoney(value, currency = MONEDA_POR_DEFECTO) {
  const amount = Number(value)
  const safeAmount = Number.isFinite(amount) ? amount : 0

  return `${currency} ${safeAmount.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function toISODate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function toISODateInDays(days, from = new Date()) {
  const date = new Date(from)
  date.setDate(date.getDate() + Number(days || 0))

  return toISODate(date)
}

export function formatDateForDisplay(date = new Date()) {
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function todayForDisplay() {
  return formatDateForDisplay(new Date())
}
