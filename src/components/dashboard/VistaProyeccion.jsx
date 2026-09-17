import { FilaDeKpis, KpiPredictivo } from "./Kpi"
import ZonaPredictiva from "./ZonaPredictiva"
import DistribucionRiesgo from "../proyeccion/DistribucionRiesgo"
import GraficaProyeccion from "../proyeccion/GraficaProyeccion"
import InversionPorCategoria from "../proyeccion/InversionPorCategoria"
import TopDemandaProyectada from "../proyeccion/TopDemandaProyectada"
import { formatMoney as money } from "../../utils/format"
import { contarProductos, describirPeriodo, formatearUnidades, palabraProductos, porcentaje } from "../../utils/proyeccion"

/* Qué se espera vender y qué conviene reponer, con todas las gráficas conectadas a los filtros. */
function VistaProyeccion({ prediccion }) {
  const metadata = prediccion.datos?.metadata

  return (
    <>
      <div className="vista-titulo">
        <h3>Proyección de demanda</h3>
        {metadata && (
          <p>
            Histórico: {describirPeriodo(metadata.periodo_historico)} · Proyección:{" "}
            {describirPeriodo(metadata.proyeccion)}
          </p>
        )}
      </div>

      <FilaDeKpis>
        <KpiPredictivo
          prediccion={prediccion}
          tono="blue"
          etiqueta="Demanda 7 días"
          unidad={() => "unidades"}
          valor={(resumen) => formatearUnidades(resumen.demanda_total_7d)}
        />
        <KpiPredictivo
          prediccion={prediccion}
          tono="blue"
          etiqueta="Demanda 30 días"
          unidad={() => "unidades"}
          valor={(resumen) => formatearUnidades(resumen.demanda_total_30d)}
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
        <KpiPredictivo
          prediccion={prediccion}
          tono="warn"
          etiqueta="Reposición"
          unidad={(resumen) => palabraProductos(resumen.productos_con_compra)}
          valor={(resumen) => formatearUnidades(resumen.productos_con_compra, 0)}
          detalle={(resumen) => `${formatearUnidades(resumen.unidades_recomendadas, 0)} unidades recomendadas`}
        />
        <KpiPredictivo
          prediccion={prediccion}
          tono="orange"
          etiqueta="Inversión estimada"
          valor={(resumen) => money(resumen.inversion_estimada)}
          detalle={() => "A costo de compra"}
        />
      </FilaDeKpis>

      <ZonaPredictiva prediccion={prediccion}>
        {(analisis) => (
          <div className="lienzo lienzo-proyeccion">
            <GraficaProyeccion serie={analisis.serie} />
            <DistribucionRiesgo
              resumen={analisis.resumenSinFiltroDeRiesgo}
              seleccionado={prediccion.filtros.riesgo}
              onSeleccionar={(riesgo) => prediccion.alternarFiltro("riesgo", riesgo)}
            />
            <TopDemandaProyectada productos={analisis.filtrados} />
            <InversionPorCategoria
              productos={analisis.sinFiltroDeCategoria}
              seleccionada={prediccion.filtros.categoria}
              onSeleccionar={(categoria) => prediccion.alternarFiltro("categoria", categoria)}
            />
          </div>
        )}
      </ZonaPredictiva>
    </>
  )
}

export default VistaProyeccion
