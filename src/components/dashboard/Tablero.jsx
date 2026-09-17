import { useMemo, useState } from "react"

import NavegacionDelTablero from "./NavegacionDelTablero"
import VistaDetalle from "./VistaDetalle"
import VistaInventario from "./VistaInventario"
import VistaProyeccion from "./VistaProyeccion"
import VistaResumen from "./VistaResumen"
import VistaVentas from "./VistaVentas"
import FiltrosPredictivos from "../proyeccion/FiltrosPredictivos"
import { useProyeccion } from "../../hooks/useProyeccion"
import {
  FILTROS_INICIALES,
  analizarProyeccion,
  describirFiltros,
  estadoDeProyeccion,
} from "../../utils/proyeccion"

const VISTAS = [
  { id: "resumen", etiqueta: "Resumen", Vista: VistaResumen, conFiltros: true },
  { id: "ventas", etiqueta: "Ventas", Vista: VistaVentas, conFiltros: false },
  { id: "inventario", etiqueta: "Inventario", Vista: VistaInventario, conFiltros: true },
  { id: "proyeccion", etiqueta: "Proyección", Vista: VistaProyeccion, conFiltros: true },
  { id: "detalle", etiqueta: "Detalle", Vista: VistaDetalle, conFiltros: true },
]

const hoyEnPalabras = () =>
  new Date().toLocaleDateString("es-HN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

/*
  El Dashboard como lienzo de BI: una vista a la vez, con la vista y los
  filtros guardados aquí para que se conserven al pasar de una a otra.

  La operación llega calculada desde la base; la proyección se carga una vez y
  se recalcula en el navegador cuando cambian los filtros. Los filtros solo
  afectan lo que viene de la proyección.

  La proyección es parte del Dashboard: quien puede verlo, la ve, sin un
  permiso aparte. El archivo ya es público y no trae datos de la base.
*/
function Tablero({ operacion }) {
  const proyeccion = useProyeccion()
  const [vistaActiva, setVistaActiva] = useState("resumen")
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)

  const analisis = useMemo(
    () => (proyeccion.datos ? analizarProyeccion(proyeccion.datos, filtros) : null),
    [proyeccion.datos, filtros]
  )

  const { Vista, conFiltros, id } = VISTAS.find((vista) => vista.id === vistaActiva)

  const prediccion = {
    estado: estadoDeProyeccion(proyeccion, analisis),
    error: proyeccion.error,
    datos: proyeccion.datos,
    analisis,
    filtros,
    alternarFiltro: (campo, valor) =>
      setFiltros((actuales) => ({
        ...actuales,
        [campo]: actuales[campo] === valor ? FILTROS_INICIALES[campo] : valor,
      })),
  }

  return (
    <div className="view active tablero">
      <div className="tablero-cabecera">
        <div className="tablero-titulo">
          <h2>Dashboard</h2>
          <span>{hoyEnPalabras()}</span>
        </div>

        <NavegacionDelTablero vistas={VISTAS} activa={vistaActiva} onCambiar={setVistaActiva} />

        {conFiltros && analisis && (
          <FiltrosPredictivos
            filtros={filtros}
            categorias={analisis.categorias}
            estado={describirFiltros(filtros, { mostrados: analisis.filtrados.length, total: analisis.total })}
            onCambiar={(campo, valor) => setFiltros((actuales) => ({ ...actuales, [campo]: valor }))}
            onRestablecer={() => setFiltros(FILTROS_INICIALES)}
          />
        )}
      </div>

      <div className="tablero-vista" role="tabpanel" id={`vista-${id}`} aria-labelledby={`pestana-${id}`}>
        <Vista operacion={operacion} prediccion={prediccion} />
      </div>
    </div>
  )
}

export default Tablero
