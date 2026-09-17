import { arcosDeDona } from "../../utils/graficas"
import { distribucionDeRiesgo } from "../../utils/proyeccion"

/* Radio con el que la circunferencia mide 100: cada arco se expresa en porcentaje. */
const RADIO = 50 / Math.PI
const CENTRO = 21

/*
  Cuántos productos caen en cada nivel de riesgo. La leyenda repite cada
  cantidad en texto y cierra con el total, para que la suma se lea sin
  depender del color ni del gráfico.
*/
function DistribucionRiesgo({ resumen }) {
  const { segmentos, total } = distribucionDeRiesgo(resumen)
  const descripcion = segmentos
    .map((segmento) => `${segmento.etiqueta}: ${segmento.cantidad} (${segmento.porcentaje}%)`)
    .join(", ")

  return (
    <div className="chart-wrap distribucion-riesgo">
      <div className="chart-title">Distribución de riesgo</div>

      <div className="dona-contenido">
        <div className="dona" role="img" aria-label={`${total} productos por nivel de riesgo. ${descripcion}.`}>
          <svg viewBox="0 0 42 42" aria-hidden="true">
            <circle className="dona-fondo" cx={CENTRO} cy={CENTRO} r={RADIO} />
            {arcosDeDona(segmentos).map((arco) => (
              <circle
                key={arco.riesgo}
                className={`dona-segmento riesgo-${arco.riesgo}`}
                data-riesgo={arco.riesgo}
                cx={CENTRO}
                cy={CENTRO}
                r={RADIO}
                strokeDasharray={`${arco.largo} ${100 - arco.largo}`}
                strokeDashoffset={25 - arco.inicio}
              />
            ))}
          </svg>
          <div className="dona-centro" aria-hidden="true">
            <strong>{total}</strong>
            <span>productos</span>
          </div>
        </div>

        <ul className="dona-leyenda">
          {segmentos.map((segmento) => (
            <li key={segmento.riesgo} data-riesgo={segmento.riesgo}>
              <i className={`muestra riesgo-${segmento.riesgo}`} aria-hidden="true" />
              <span>{segmento.etiqueta}</span>
              <span className="dona-cantidad">{segmento.cantidad}</span>
              <span className="dona-porcentaje">{segmento.porcentaje}%</span>
            </li>
          ))}
          <li className="dona-total">
            <i aria-hidden="true" />
            <span>Total</span>
            <span className="dona-cantidad">{total}</span>
            <span className="dona-porcentaje" />
          </li>
        </ul>
      </div>
    </div>
  )
}

export default DistribucionRiesgo
