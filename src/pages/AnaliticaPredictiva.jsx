import { useEffect, useState } from "react"

import { traerProyeccion } from "../lib/api/proyeccion"
import {
  aclaracionDelEscenario,
  describirPeriodo,
  describirPeriodoEnPalabras,
} from "../utils/proyeccion"
import DistribucionRiesgo from "../components/proyeccion/DistribucionRiesgo"
import GraficaProyeccion from "../components/proyeccion/GraficaProyeccion"
import IndicadoresPredictivos from "../components/proyeccion/IndicadoresPredictivos"
import InversionPorCategoria from "../components/proyeccion/InversionPorCategoria"
import RecomendacionesInventario from "../components/proyeccion/RecomendacionesInventario"
import TopDemandaProyectada from "../components/proyeccion/TopDemandaProyectada"

/*
  Qué esperamos que ocurra y qué conviene reponer.

  El Dashboard cuenta lo que ya pasó con los datos de la operación; esta
  página muestra un escenario calculado aparte, con historia simulada hasta
  la fecha de corte. No es información en tiempo real, y así se presenta.
*/
function AnaliticaPredictiva() {
  const [estado, setEstado] = useState({ datos: null, error: "" })

  useEffect(() => {
    let vigente = true

    traerProyeccion()
      .then((datos) => {
        if (vigente) setEstado({ datos, error: "" })
      })
      .catch((problema) => {
        if (vigente) setEstado({ datos: null, error: problema.message })
      })

    return () => {
      vigente = false
    }
  }, [])

  const { datos, error } = estado

  return (
    <div className="view active analitica">
      <div className="view-header">
        <div>
          <h2>Analítica Predictiva</h2>
          <p className="sub">Pronóstico de demanda y apoyo a decisiones de inventario</p>
          {datos && (
            <p className="analitica-periodos">
              Histórico: {describirPeriodo(datos.metadata.periodo_historico)} · Proyección:{" "}
              {describirPeriodo(datos.metadata.proyeccion)}
            </p>
          )}
        </div>
      </div>

      {error && <div className="empty-state analitica-error" role="alert">{error}</div>}

      {!error && !datos && <div className="empty-state" role="status">Cargando Analítica Predictiva…</div>}

      {datos && <ContenidoAnalitico datos={datos} />}
    </div>
  )
}

function ContenidoAnalitico({ datos }) {
  const { metadata, resumen, serie_mensual: serie, productos } = datos

  return (
    <>
      <p className="analitica-aclaracion">
        <span className="etiqueta-escenario">Escenario académico</span>
        {aclaracionDelEscenario(metadata)}
      </p>

      <IndicadoresPredictivos metadata={metadata} resumen={resumen} />

      <div className="analitica-graficas">
        <GraficaProyeccion serie={serie} />
        <DistribucionRiesgo resumen={resumen} />
        <TopDemandaProyectada productos={productos} />
        <InversionPorCategoria productos={productos} />
      </div>

      <RecomendacionesInventario productos={productos} />

      <p className="analitica-metodologia">
        Modelo de predicción: {metadata.modelo}. Entrenado con datos históricos simulados de{" "}
        {describirPeriodoEnPalabras(metadata.periodo_historico)} y evaluado mediante backtesting temporal
        contra una media móvil de 28 días.
      </p>
    </>
  )
}

export default AnaliticaPredictiva
