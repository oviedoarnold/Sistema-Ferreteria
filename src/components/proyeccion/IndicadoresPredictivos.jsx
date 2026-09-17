import { formatMoney } from "../../utils/format"
import { formatearUnidades, porcentaje } from "../../utils/proyeccion"

function Indicador({ tono, etiqueta, valor, unidad, detalle }) {
  return (
    <div className={`stat-card ${tono}`}>
      <div className="label">{etiqueta}</div>
      <div className="value">
        {valor}
        {unidad && <span className="unidad">{unidad}</span>}
      </div>
      <div className="sub-val">{detalle}</div>
    </div>
  )
}

/*
  Las cinco cifras que resumen el escenario. Todas salen del archivo
  publicado: si el pipeline cambia un resultado, cambia aquí.
*/
function IndicadoresPredictivos({ metadata, resumen }) {
  return (
    <div className="dash-grid dash-grid-cinco">
      <Indicador
        tono="blue"
        etiqueta="Demanda 30 días"
        valor={formatearUnidades(resumen.demanda_total_30d)}
        unidad="unidades"
        detalle={`${formatearUnidades(resumen.demanda_total_7d)} unidades / 7 días`}
      />
      <Indicador
        tono="danger"
        etiqueta="Riesgo alto"
        valor={formatearUnidades(resumen.productos_riesgo_alto, 0)}
        unidad="productos"
        detalle={`${porcentaje(resumen.productos_riesgo_alto, metadata.productos)}% del escenario analizado`}
      />
      <Indicador
        tono="warn"
        etiqueta="Reposición"
        valor={formatearUnidades(resumen.productos_con_compra, 0)}
        unidad="productos"
        detalle={`${formatearUnidades(resumen.unidades_recomendadas, 0)} unidades recomendadas`}
      />
      <Indicador
        tono="orange"
        etiqueta="Inversión estimada"
        valor={formatMoney(resumen.inversion_estimada)}
        detalle="A costo de compra"
      />
      <Indicador
        tono="neutral"
        etiqueta="Productos analizados"
        valor={formatearUnidades(metadata.productos, 0)}
        detalle={`${metadata.productos_sistema} sistema · ${metadata.productos_simulados} simulados`}
      />
    </div>
  )
}

export default IndicadoresPredictivos
