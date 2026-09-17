import {
  esVentaDelDia,
  esVentaDelMes,
  esVentaVigente,
  getSaleBalance,
  totalesDeVentasPorMes,
} from "./salesUtils"

const sumarTotales = (ventas) => ventas.reduce((suma, venta) => suma + Number(venta.total || 0), 0)

/*
  Las cifras de la operación que muestra el Dashboard, calculadas una vez y
  compartidas por todas sus vistas.

  Lo facturado y lo anulado son dos cosas distintas. Las anuladas siguen en
  la actividad reciente, pero no suman en ninguna cifra comercial: una venta
  que se deshizo no es ingreso.
*/
export function resumirOperacion({ productos = [], ventas = [], clientes = [] } = {}) {
  const vigentes = ventas.filter(esVentaVigente)

  const vendidos = new Map()
  vigentes.forEach((venta) =>
    (venta.items || venta.products || []).forEach((item) => {
      const nombre = item.name || item.productName || "Producto"
      vendidos.set(nombre, (vendidos.get(nombre) || 0) + Number(item.qty ?? item.quantity ?? 1))
    })
  )

  return {
    ventasHoy: sumarTotales(vigentes.filter((venta) => esVentaDelDia(venta))),
    ventasDelMes: sumarTotales(vigentes.filter((venta) => esVentaDelMes(venta))),
    stockBajo: productos.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock ?? 5)).length,
    agotados: productos.filter((p) => Number(p.stock) <= 0).length,
    // Descuenta los abonos: lo pendiente es el saldo, no el total facturado.
    porCobrar: vigentes.reduce((suma, venta) => suma + getSaleBalance(venta), 0),
    productos: productos.length,
    clientes,
    ventasPorMes: totalesDeVentasPorMes(vigentes),
    masVendidos: [...vendidos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    ultimasVentas: [...ventas].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, 5),
  }
}
