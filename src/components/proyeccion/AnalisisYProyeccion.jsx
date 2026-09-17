import { useEffect, useMemo, useState } from "react"

import { traerProyeccion } from "../../lib/api/proyeccion"
import {
  FILTROS_INICIALES,
  TODAS_LAS_CATEGORIAS,
  TODOS_LOS_RIESGOS,
  categoriasDe,
  describirFiltros,
  describirPeriodo,
  filtrarProductos,
  hayFiltrosActivos,
  resumirProductos,
  serieDeDemanda,
} from "../../utils/proyeccion"
import DistribucionRiesgo from "./DistribucionRiesgo"
import FiltrosPredictivos from "./FiltrosPredictivos"
import GraficaProyeccion from "./GraficaProyeccion"
import IndicadoresPredictivos from "./IndicadoresPredictivos"
import InversionPorCategoria from "./InversionPorCategoria"
import RecomendacionesInventario from "./RecomendacionesInventario"
import TopDemandaProyectada from "./TopDemandaProyectada"

/*
  Análisis y proyección: qué se espera vender y qué conviene reponer.

  Carga su propio archivo, aparte de los datos de la operación. Si falla,
  solo este bloque lo dice; ventas, stock y clientes siguen funcionando.

  Es visible para quien puede entrar al Dashboard: forma parte de él. El
  archivo ya es público y no contiene datos de la base, así que no se pide
  un permiso aparte ni cambia ninguna política de Supabase.
*/
function AnalisisYProyeccion() {
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
    <section className="analitica" aria-labelledby="titulo-analisis">
      <div className="seccion-dashboard">
        <h3 id="titulo-analisis">Análisis y proyección</h3>
        {datos && (
          <p className="analitica-periodos">
            Histórico: {describirPeriodo(datos.metadata.periodo_historico)} · Proyección:{" "}
            {describirPeriodo(datos.metadata.proyeccion)}
          </p>
        )}
      </div>

      {error && <div className="empty-state analitica-aviso" role="alert">{error}</div>}

      {!error && !datos && <div className="empty-state" role="status">Cargando proyección de demanda…</div>}

      {datos && <PanelPredictivo datos={datos} />}
    </section>
  )
}

/*
  Los filtros se combinan como intersección y todo se recalcula en el
  navegador sobre el detalle ya cargado: no hay otra petición.

  La dona y las barras de categoría funcionan como en un tablero de BI: cada
  una se calcula sin su propio filtro, para mostrar las demás opciones con la
  elegida resaltada. La dona respeta la categoría y las barras respetan el
  riesgo; tarjetas, histórico, top y tabla respetan ambos.
*/
function PanelPredictivo({ datos }) {
  const { productos, serie_mensual: plantillaDeMeses } = datos
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)

  const categorias = useMemo(() => categoriasDe(productos), [productos])
  const filtrados = useMemo(() => filtrarProductos(productos, filtros), [productos, filtros])
  const sinFiltroDeRiesgo = useMemo(
    () => filtrarProductos(productos, { ...filtros, riesgo: TODOS_LOS_RIESGOS }),
    [productos, filtros]
  )
  const sinFiltroDeCategoria = useMemo(
    () => filtrarProductos(productos, { ...filtros, categoria: TODAS_LAS_CATEGORIAS }),
    [productos, filtros]
  )

  const cambiarFiltro = (campo, valor) => setFiltros((actuales) => ({ ...actuales, [campo]: valor }))

  const alternarFiltro = (campo, valor) =>
    setFiltros((actuales) => ({
      ...actuales,
      [campo]: actuales[campo] === valor ? FILTROS_INICIALES[campo] : valor,
    }))

  return (
    <>
      <FiltrosPredictivos
        filtros={filtros}
        categorias={categorias}
        estado={describirFiltros(filtros, { mostrados: filtrados.length, total: productos.length })}
        onCambiar={cambiarFiltro}
        onRestablecer={() => setFiltros(FILTROS_INICIALES)}
      />

      {filtrados.length === 0 ? (
        <div className="empty-state analitica-aviso" role="status">
          No hay productos que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <>
          <IndicadoresPredictivos resumen={resumirProductos(filtrados)} />

          <div className="analitica-graficas">
            <GraficaProyeccion serie={serieDeDemanda(filtrados, plantillaDeMeses)} />
            <DistribucionRiesgo
              resumen={resumirProductos(sinFiltroDeRiesgo)}
              seleccionado={filtros.riesgo}
              onSeleccionar={(riesgo) => alternarFiltro("riesgo", riesgo)}
            />
            <TopDemandaProyectada productos={filtrados} />
            <InversionPorCategoria
              productos={sinFiltroDeCategoria}
              seleccionada={filtros.categoria}
              onSeleccionar={(categoria) => alternarFiltro("categoria", categoria)}
            />
          </div>

          <RecomendacionesInventario productos={filtrados} hayFiltros={hayFiltrosActivos(filtros)} />
        </>
      )}
    </>
  )
}

export default AnalisisYProyeccion
