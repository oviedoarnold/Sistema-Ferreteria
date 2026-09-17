import { FilaDeKpis, Kpi, KpiPredictivo } from "./Kpi"
import { GraficaVentasPorMes, ListaMasVendidos } from "./WidgetsDeOperacion"
import ZonaPredictiva from "./ZonaPredictiva"
import DistribucionRiesgo from "../proyeccion/DistribucionRiesgo"
import GraficaProyeccion from "../proyeccion/GraficaProyeccion"
import TopDemandaProyectada from "../proyeccion/TopDemandaProyectada"
import { formatMoney as money } from "../../utils/format"
import { contarProductos, formatearUnidades, palabraProductos, porcentaje } from "../../utils/proyeccion"

const PRODUCTOS_EN_TOP_DEL_RESUMEN = 5

const contarAgotados = (cantidad) => `${cantidad} ${cantidad === 1 ? "agotado" : "agotados"}`

/*
  La vista ejecutiva: lo más importante de la operación y de la proyección en
  un solo lienzo. El detalle vive en las otras vistas.
*/
function VistaResumen({ operacion, prediccion }) {
  return (
    <>
      <FilaDeKpis>
        <Kpi tono="orange" etiqueta="Ventas hoy" valor={money(operacion.ventasHoy)} detalle="Total del día" />
        <Kpi tono="orange" etiqueta="Ventas del mes" valor={money(operacion.ventasDelMes)} detalle="Mes actual" />
        <Kpi etiqueta="Por cobrar" valor={money(operacion.porCobrar)} detalle="Ventas a crédito" />
        <Kpi tono="warn" etiqueta="Stock bajo" valor={operacion.stockBajo} unidad={palabraProductos(operacion.stockBajo)} detalle={contarAgotados(operacion.agotados)} />
        <KpiPredictivo
          prediccion={prediccion}
          tono="blue"
          etiqueta="Demanda 30 días"
          unidad={() => "unidades"}
          valor={(resumen) => formatearUnidades(resumen.demanda_total_30d)}
          detalle={(resumen) => `${formatearUnidades(resumen.demanda_total_7d)} en 7 días`}
        />
        <KpiPredictivo
          prediccion={prediccion}
          tono="danger"
          etiqueta="Riesgo alto"
          unidad={(resumen) => palabraProductos(resumen.productos_riesgo_alto)}
          valor={(resumen) => formatearUnidades(resumen.productos_riesgo_alto, 0)}
          detalle={(resumen) =>
            `${porcentaje(resumen.productos_riesgo_alto, resumen.productos)}% de ${contarProductos(resumen.productos)}`
          }
        />
      </FilaDeKpis>

      <div className="lienzo lienzo-resumen">
        <div className="celda area-ventas">
          <GraficaVentasPorMes ventasPorMes={operacion.ventasPorMes} />
        </div>
        <div className="celda area-vendidos">
          <ListaMasVendidos masVendidos={operacion.masVendidos} />
        </div>

        <ZonaPredictiva prediccion={prediccion} className="area-prediccion">
          {(analisis) => (
            <>
              <div className="celda area-riesgo">
                <DistribucionRiesgo
                  resumen={analisis.resumenSinFiltroDeRiesgo}
                  seleccionado={prediccion.filtros.riesgo}
                  onSeleccionar={(riesgo) => prediccion.alternarFiltro("riesgo", riesgo)}
                />
              </div>
              <div className="celda area-top">
                <TopDemandaProyectada productos={analisis.filtrados} limite={PRODUCTOS_EN_TOP_DEL_RESUMEN} />
              </div>
              <div className="celda area-historico">
                <GraficaProyeccion serie={analisis.serie} />
              </div>
            </>
          )}
        </ZonaPredictiva>
      </div>
    </>
  )
}

export default VistaResumen
