import { FilaDeKpis, Kpi, KpiPredictivo } from "./Kpi"
import ZonaPredictiva from "./ZonaPredictiva"
import DistribucionRiesgo from "../proyeccion/DistribucionRiesgo"
import InversionPorCategoria from "../proyeccion/InversionPorCategoria"
import ReposicionPrioritaria from "../proyeccion/ReposicionPrioritaria"
import { contarProductos, formatearUnidades, palabraProductos } from "../../utils/proyeccion"

/*
  Existencias del sistema y reposición recomendada. Productos, stock bajo y
  agotados vienen de la base; la reposición, de la proyección, y su detalle
  lo dice para que no se lean como la misma cuenta.
*/
function VistaInventario({ operacion, prediccion }) {
  return (
    <>
      <FilaDeKpis>
        <Kpi etiqueta="Productos" valor={operacion.productos} detalle="Registrados en el sistema" />
        <Kpi tono="warn" etiqueta="Stock bajo" valor={operacion.stockBajo} unidad={palabraProductos(operacion.stockBajo)} />
        <Kpi tono="danger" etiqueta="Agotados" valor={operacion.agotados} unidad={palabraProductos(operacion.agotados)} />
        <KpiPredictivo
          prediccion={prediccion}
          tono="blue"
          etiqueta="Con reposición"
          unidad={(resumen) => palabraProductos(resumen.productos_con_compra)}
          valor={(resumen) => formatearUnidades(resumen.productos_con_compra, 0)}
          detalle={(resumen) => `de ${contarProductos(resumen.productos)} proyectados`}
        />
      </FilaDeKpis>

      <ZonaPredictiva prediccion={prediccion}>
        {(analisis) => (
          <div className="lienzo lienzo-tres">
            <DistribucionRiesgo
              resumen={analisis.resumenSinFiltroDeRiesgo}
              seleccionado={prediccion.filtros.riesgo}
              onSeleccionar={(riesgo) => prediccion.alternarFiltro("riesgo", riesgo)}
            />
            <InversionPorCategoria
              productos={analisis.sinFiltroDeCategoria}
              seleccionada={prediccion.filtros.categoria}
              onSeleccionar={(categoria) => prediccion.alternarFiltro("categoria", categoria)}
            />
            <ReposicionPrioritaria productos={analisis.filtrados} />
          </div>
        )}
      </ZonaPredictiva>
    </>
  )
}

export default VistaInventario
