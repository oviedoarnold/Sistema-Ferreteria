import { Children } from "react"

import { esVentaAnulada } from "../../utils/salesUtils"
import { largoDeBarra } from "../../utils/graficas"
import { formatMoney as money, formatMoneyCompacto } from "../../utils/format"

/*
  Lo facturado en cada uno de los últimos meses, medido contra el mes que más
  vendió. Sobre cada barra va el monto abreviado, que cabe aunque la columna
  sea angosta; el exacto está en el nombre accesible y al pasar el mouse.
*/
export function GraficaVentasPorMes({ ventasPorMes }) {
  const mayorVentaMensual = Math.max(0, ...ventasPorMes.map((mes) => mes.total))

  return (
    <div className="chart-wrap">
      <div className="chart-title">Ventas registradas por mes</div>
      <div className="bar-chart">
        {ventasPorMes.map((mes) => {
          const descripcion = `${mes.etiqueta}: ${mes.total ? money(mes.total) : "sin ventas"}`

          return (
            <div className="bar-col" key={mes.clave} data-mes={mes.clave} title={descripcion}>
              <div className="bar-val" aria-hidden="true">{mes.total ? formatMoneyCompacto(mes.total) : "—"}</div>
              <div className="bar-pista">
                <div
                  className="bar"
                  style={{ height: `${largoDeBarra(mes.total, mayorVentaMensual)}%` }}
                  role="img"
                  aria-label={descripcion}
                />
              </div>
              <div className="bar-label">{mes.etiqueta}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListaCompacta({ titulo, vacio, children }) {
  const hayFilas = Children.count(children) > 0

  return (
    <div className="chart-wrap">
      <div className="chart-title">{titulo}</div>
      <div className="dash-mini-list">{hayFilas ? children : <div className="empty-state">{vacio}</div>}</div>
    </div>
  )
}

export function ListaMasVendidos({ masVendidos }) {
  return (
    <ListaCompacta titulo="Top productos vendidos" vacio="Sin ventas todavía">
      {masVendidos.map(([nombre, cantidad]) => (
        <div className="dash-mini-row" key={nombre}>
          <span className="name">{nombre}</span>
          <span className="val">{cantidad} u.</span>
        </div>
      ))}
    </ListaCompacta>
  )
}

export function UltimasVentas({ ultimasVentas }) {
  return (
    <ListaCompacta titulo="Últimas ventas" vacio="Sin ventas todavía">
      {ultimasVentas.map((venta) => (
        <div className="dash-mini-row" key={venta.id}>
          <span className="name">
            {venta.customer || venta.clientName || "Consumidor Final"}
            {esVentaAnulada(venta) && <span className="badge badge-void"> Anulada</span>}
          </span>
          <span className="val">{money(venta.total)}</span>
        </div>
      ))}
    </ListaCompacta>
  )
}

export function ClientesRecientes({ clientes }) {
  return (
    <ListaCompacta titulo="Clientes" vacio="Sin clientes registrados">
      {clientes.slice(0, 5).map((cliente) => (
        <div className="dash-mini-row" key={cliente.id}>
          <span className="name">{cliente.name}</span>
          <span className="val">{cliente.phone || "—"}</span>
        </div>
      ))}
    </ListaCompacta>
  )
}
