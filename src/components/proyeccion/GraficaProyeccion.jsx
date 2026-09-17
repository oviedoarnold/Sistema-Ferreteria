import { alturaDeBarra } from "../../utils/graficas"
import { formatearUnidades } from "../../utils/proyeccion"

/*
  Demanda mensual: lo que ya pasó y lo que se proyecta.

  El modelo predice la demanda ACUMULADA de los próximos 30 días, no una
  serie diaria. Por eso septiembre es una sola barra y no una curva: dibujar
  días de septiembre sería mostrar algo que el modelo nunca produjo.

  Mismas barras que "Ventas por mes", con la proyección en el estilo
  secundario y además rotulada: la diferencia no depende solo del color.

  Cada barra va dentro de una pista que ocupa el alto libre de la columna:
  sin un alto definido en el padre, el porcentaje no se resuelve y todas las
  barras quedan en su altura mínima.
*/
function GraficaProyeccion({ serie = [] }) {
  const maximo = Math.max(0, ...serie.map((mes) => Number(mes.unidades)))

  return (
    <div className="chart-wrap">
      <div className="chart-title">Demanda mensual en unidades</div>

      <div className="proyeccion-leyenda">
        <span><i className="muestra muestra-historico" />Histórico</span>
        <span><i className="muestra muestra-proyeccion" />Proyección</span>
      </div>

      <div className="bar-chart bar-chart-proyeccion">
        {serie.map((mes) => {
          const proyectado = mes.tipo === "proyeccion"
          const texto = `${mes.etiqueta}: ${formatearUnidades(mes.unidades, 0)} unidades${proyectado ? " (proyección)" : ""}`

          return (
            <div className="bar-col" key={mes.mes} data-tipo={mes.tipo} title={texto}>
              <div className="bar-val">{formatearUnidades(mes.unidades, 0)}</div>
              <div className="bar-pista">
                <div
                  className={proyectado ? "bar secondary" : "bar"}
                  style={{ height: `${alturaDeBarra(mes.unidades, maximo)}%` }}
                  role="img"
                  aria-label={texto}
                />
              </div>
              <div className="bar-label">
                {mes.etiqueta}
                {proyectado && <span className="bar-marca">proy.</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default GraficaProyeccion
