import { arcosDeDona } from "../../utils/graficas"
import { distribucionDeRiesgo } from "../../utils/proyeccion"

/* Radio con el que la circunferencia mide 100: cada arco se expresa en porcentaje. */
const RADIO = 50 / Math.PI
const CENTRO = 21

const TECLAS_DE_ACTIVACION = new Set(["Enter", " "])

/*
  Cuántos productos caen en cada nivel de riesgo. La leyenda repite cada
  cantidad en texto y cierra con el total, para que la suma se lea sin
  depender del color ni del gráfico.

  Cada segmento es un botón: filtra el Dashboard por ese riesgo y un segundo
  clic lo quita. El selector de riesgo de la barra de filtros hace lo mismo.
*/
function DistribucionRiesgo({ resumen, seleccionado, onSeleccionar }) {
  const { segmentos, total } = distribucionDeRiesgo(resumen)
  const haySeleccion = segmentos.some((segmento) => segmento.riesgo === seleccionado)

  const activarConTeclado = (evento, riesgo) => {
    if (!TECLAS_DE_ACTIVACION.has(evento.key)) return

    evento.preventDefault()
    onSeleccionar(riesgo)
  }

  return (
    <div className={`chart-wrap distribucion-riesgo${haySeleccion ? " con-seleccion" : ""}`}>
      <div className="chart-title">Distribución de riesgo</div>

      <div className="dona-contenido">
        <div className="dona">
          <svg viewBox="0 0 42 42" role="group" aria-label={`${total} productos por nivel de riesgo`}>
            <circle className="dona-fondo" cx={CENTRO} cy={CENTRO} r={RADIO} aria-hidden="true" />
            {arcosDeDona(segmentos).map((arco) => (
              <circle
                key={arco.riesgo}
                className={`dona-segmento riesgo-${arco.riesgo}${arco.riesgo === seleccionado ? " elegido" : ""}`}
                data-riesgo={arco.riesgo}
                cx={CENTRO}
                cy={CENTRO}
                r={RADIO}
                strokeDasharray={`${arco.largo} ${100 - arco.largo}`}
                strokeDashoffset={25 - arco.inicio}
                role="button"
                tabIndex={arco.cantidad > 0 ? 0 : -1}
                aria-pressed={arco.riesgo === seleccionado}
                aria-label={`Riesgo ${arco.etiqueta.toLowerCase()}: ${arco.cantidad} productos (${arco.porcentaje}%)`}
                onClick={() => onSeleccionar(arco.riesgo)}
                onKeyDown={(evento) => activarConTeclado(evento, arco.riesgo)}
              >
                <title>{`${arco.etiqueta}: ${arco.cantidad} productos (${arco.porcentaje}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="dona-centro" aria-hidden="true">
            <strong>{total}</strong>
            <span>productos</span>
          </div>
        </div>

        <ul className="dona-leyenda">
          {segmentos.map((segmento) => (
            <li
              key={segmento.riesgo}
              data-riesgo={segmento.riesgo}
              className={segmento.riesgo === seleccionado ? "elegido" : undefined}
            >
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
