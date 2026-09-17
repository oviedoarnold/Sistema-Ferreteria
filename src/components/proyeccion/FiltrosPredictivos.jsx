import { RIESGOS, TODAS_LAS_CATEGORIAS, TODOS_LOS_RIESGOS } from "../../utils/proyeccion"

/*
  Los filtros del bloque de proyección. Son la vía de teclado para todo lo
  que también se puede elegir con un clic en la dona o en las barras de
  categoría. Solo afectan la proyección: las cifras de la operación vienen de
  otra fuente y no se recalculan.
*/
function FiltrosPredictivos({ filtros, categorias, estado, onCambiar, onRestablecer }) {
  return (
    <div className="filtros-predictivos" role="group" aria-label="Filtros de la proyección">
      <label className="filtro-predictivo">
        <span>Categoría</span>
        <select value={filtros.categoria} onChange={(evento) => onCambiar("categoria", evento.target.value)}>
          <option value={TODAS_LAS_CATEGORIAS}>Todas</option>
          {categorias.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
      </label>

      <label className="filtro-predictivo">
        <span>Riesgo</span>
        <select value={filtros.riesgo} onChange={(evento) => onCambiar("riesgo", evento.target.value)}>
          <option value={TODOS_LOS_RIESGOS}>Todos</option>
          {Object.entries(RIESGOS).map(([valor, { etiqueta }]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      <p className="filtros-estado" aria-live="polite">
        {estado}
      </p>

      <button type="button" className="btn btn-secondary btn-sm" onClick={onRestablecer}>
        Restablecer filtros
      </button>
    </div>
  )
}

export default FiltrosPredictivos
