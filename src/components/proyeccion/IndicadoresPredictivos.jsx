import { formatMoney } from "../../utils/format"
import { contarProductos, formatearUnidades, porcentaje } from "../../utils/proyeccion"

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
  Las cuatro cifras de la proyección para los productos que dejan los
  filtros. Se calculan del detalle publicado: sin filtros, son el resumen del
  pipeline.
*/
function IndicadoresPredictivos({ resumen }) {
  return (
    <div className="dash-grid dash-grid-cuatro">
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
        detalle={`${porcentaje(resumen.productos_riesgo_alto, resumen.productos)}% de ${contarProductos(resumen.productos)}`}
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
    </div>
  )
}

export default IndicadoresPredictivos
