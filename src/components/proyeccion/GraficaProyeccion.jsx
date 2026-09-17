import { escalaDeEje, largoDeBarra } from "../../utils/graficas"
import { formatearUnidades } from "../../utils/proyeccion"

/*
  Demanda mensual: lo que ya pasó y lo que se proyecta.

  El modelo predice la demanda ACUMULADA de los próximos 30 días, no una
  serie diaria. Por eso septiembre es una sola barra y no una curva: dibujar
  días de septiembre sería mostrar algo que el modelo nunca produjo.

  La proyección va en el estilo secundario y además rotulada: la diferencia
  no depende solo del color. Las barras se miden contra el tope del eje, así
  que las guías y las barras usan la misma escala.
*/
function GraficaProyeccion({ serie = [] }) {
  const { tope, marcas } = escalaDeEje(Math.max(0, ...serie.map((mes) => Number(mes.unidades))))
  const posicion = (valor) => `${(valor / tope) * 100}%`

  return (
    <div className="chart-wrap grafica-mensual">
      <div className="chart-title">Demanda histórica y proyección</div>
      <p className="chart-subtitulo">Unidades por mes · pasa el mouse sobre una barra para ver el detalle</p>

      <div className="proyeccion-leyenda">
        <span><i className="muestra muestra-historico" />Histórico</span>
        <span><i className="muestra muestra-proyeccion" />Proyección</span>
      </div>

      <div className="grafica-cuerpo">
        <div className="grafica-eje" aria-hidden="true">
          {marcas.map((marca) => (
            <span key={marca} style={{ bottom: posicion(marca) }}>{formatearUnidades(marca, 0)}</span>
          ))}
        </div>

        <div className="grafica-trazado">
          <div className="grafica-guias" aria-hidden="true">
            {marcas.map((marca) => (
              <i key={marca} style={{ bottom: posicion(marca) }} />
            ))}
          </div>

          <div className="bar-chart bar-chart-proyeccion">
            {serie.map((mes) => {
              const proyectado = mes.tipo === "proyeccion"
              const unidades = formatearUnidades(mes.unidades, 0)
              const texto = `${mes.etiqueta}: ${unidades} unidades${proyectado ? " (proyección)" : ""}`
              const alto = largoDeBarra(mes.unidades, tope)

              return (
                <div className="bar-col" key={mes.mes} data-tipo={mes.tipo} title={texto}>
                  <div className="bar-pista">
                    <div
                      className={proyectado ? "bar secondary" : "bar"}
                      style={{ height: `${alto}%` }}
                      role="img"
                      aria-label={texto}
                    />
                    <span className="bar-val" style={{ bottom: `calc(${alto}% + 3px)` }} aria-hidden="true">
                      {unidades}
                    </span>
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
      </div>
    </div>
  )
}

export default GraficaProyeccion
