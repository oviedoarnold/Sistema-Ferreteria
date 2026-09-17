import { FilaDeKpis, Kpi } from "./Kpi"
import { ClientesRecientes, GraficaVentasPorMes, ListaMasVendidos, UltimasVentas } from "./WidgetsDeOperacion"
import { formatMoney as money } from "../../utils/format"

/* Lo que registró el sistema: ventas, cobranza y clientes. No usa la proyección. */
function VistaVentas({ operacion }) {
  return (
    <>
      <FilaDeKpis>
        <Kpi tono="orange" etiqueta="Ventas hoy" valor={money(operacion.ventasHoy)} detalle="Total del día" />
        <Kpi tono="orange" etiqueta="Ventas del mes" valor={money(operacion.ventasDelMes)} detalle="Mes actual" />
        <Kpi etiqueta="Por cobrar" valor={money(operacion.porCobrar)} detalle="Ventas a crédito" />
        <Kpi
          etiqueta="Clientes"
          valor={operacion.clientes.length}
          detalle="Registrados"
        />
      </FilaDeKpis>

      <div className="lienzo lienzo-dos">
        <GraficaVentasPorMes ventasPorMes={operacion.ventasPorMes} />
        <ListaMasVendidos masVendidos={operacion.masVendidos} />
        <UltimasVentas ultimasVentas={operacion.ultimasVentas} />
        <ClientesRecientes clientes={operacion.clientes} />
      </div>
    </>
  )
}

export default VistaVentas
