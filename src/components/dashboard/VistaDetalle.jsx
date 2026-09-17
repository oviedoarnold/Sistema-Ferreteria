import ZonaPredictiva from "./ZonaPredictiva"
import RecomendacionesInventario from "../proyeccion/RecomendacionesInventario"
import { hayFiltrosActivos } from "../../utils/proyeccion"

/* La tabla completa de recomendaciones: la vista donde se decide qué comprar. */
function VistaDetalle({ prediccion }) {
  return (
    <ZonaPredictiva prediccion={prediccion}>
      {(analisis) => (
        <RecomendacionesInventario productos={analisis.filtrados} hayFiltros={hayFiltrosActivos(prediccion.filtros)} />
      )}
    </ZonaPredictiva>
  )
}

export default VistaDetalle
