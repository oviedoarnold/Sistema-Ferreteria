import { useEffect, useState } from "react"

import { traerProyeccion } from "../../lib/api/proyeccion"
import { formatMoney } from "../../utils/format"
import { describirPeriodo, formatearUnidades } from "../../utils/proyeccion"
import GraficaProyeccion from "./GraficaProyeccion"
import RecomendacionesInventario from "./RecomendacionesInventario"

/*
  Proyección de demanda e inventario: lo que probablemente pase y qué
  conviene reponer.

  Vive aparte del resto del Dashboard y carga su propio archivo. Si la
  proyección falla, esta sección lo dice y el resto de la pantalla —ventas,
  stock, cobranza— sigue funcionando igual.

  No es información en tiempo real: es un escenario calculado con historia
  simulada hasta la fecha de corte, y así se presenta.
*/
function ProyeccionDemanda() {
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
    <section className="proyeccion" aria-labelledby="titulo-proyeccion">
      <div className="proyeccion-cabecera">
        <h3 id="titulo-proyeccion">Proyección de demanda e inventario</h3>
        {datos && (
          <p className="sub">
            Escenario de reposición · Datos históricos: {describirPeriodo(datos.metadata.periodo_historico)}
          </p>
        )}
      </div>

      {error && <div className="empty-state proyeccion-error">{error}</div>}

      {!error && !datos && <div className="empty-state">Cargando proyección…</div>}

      {datos && <ContenidoProyeccion datos={datos} />}
    </section>
  )
}

function ContenidoProyeccion({ datos }) {
  const { metadata, resumen, serie_mensual: serie, productos } = datos

  return (
    <>
      <p className="proyeccion-aclaracion">{metadata.aclaracion}</p>

      <div className="dash-grid dash-grid-cuatro">
        <div className="stat-card blue">
          <div className="label">Demanda proyectada 30 días</div>
          <div className="value">{formatearUnidades(resumen.demanda_total_30d)}</div>
          <div className="sub-val">
            unidades · 7 días: {formatearUnidades(resumen.demanda_total_7d)}
          </div>
        </div>

        <div className="stat-card danger">
          <div className="label">Productos en riesgo alto</div>
          <div className="value">{formatearUnidades(resumen.productos_riesgo_alto, 0)}</div>
          <div className="sub-val">de {metadata.productos} productos</div>
        </div>

        <div className="stat-card warn">
          <div className="label">Con reposición recomendada</div>
          <div className="value">{formatearUnidades(resumen.productos_con_compra, 0)}</div>
          <div className="sub-val">
            productos · {formatearUnidades(resumen.unidades_recomendadas, 0)} unidades
          </div>
        </div>

        <div className="stat-card orange">
          <div className="label">Inversión estimada</div>
          <div className="value">{formatMoney(resumen.inversion_estimada)}</div>
          <div className="sub-val">a costo de compra</div>
        </div>
      </div>

      <GraficaProyeccion serie={serie} />

      <RecomendacionesInventario productos={productos} />

      <p className="proyeccion-modelo">
        Modelo de predicción: {metadata.modelo}. Predicción académica entrenada con datos
        históricos simulados de {describirPeriodo(metadata.periodo_historico)}. {metadata.referencia}
      </p>
    </>
  )
}

export default ProyeccionDemanda
