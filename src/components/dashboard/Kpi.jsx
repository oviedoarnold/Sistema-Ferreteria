import { Children } from "react"

/* Una cifra para escanear rápido: etiqueta, valor y un detalle pequeño. */
export function Kpi({ tono = "neutral", etiqueta, valor, unidad, detalle }) {
  return (
    <div className={`kpi kpi-${tono}`}>
      <div className="kpi-etiqueta">{etiqueta}</div>
      <div className="kpi-valor">
        {valor}
        {unidad && <span className="kpi-unidad">{unidad}</span>}
      </div>
      {detalle && <div className="kpi-detalle">{detalle}</div>}
    </div>
  )
}

const DETALLE_SIN_PROYECCION = {
  cargando: "Cargando…",
  error: "No disponible",
  vacio: "Sin coincidencias",
}

/*
  Una cifra de la proyección. Valor, unidad y detalle se calculan con el
  resumen de los productos filtrados. Mientras no hay datos, o si los filtros
  no dejan productos, muestra un guion y dice por qué: un cero se leería como
  resultado.
*/
export function KpiPredictivo({ prediccion, valor, unidad, detalle, ...resto }) {
  const lista = prediccion.estado === "listo"

  return (
    <Kpi
      {...resto}
      valor={lista ? valor(prediccion.analisis.resumen) : "—"}
      unidad={lista ? unidad?.(prediccion.analisis.resumen) : undefined}
      detalle={lista ? detalle?.(prediccion.analisis.resumen) : DETALLE_SIN_PROYECCION[prediccion.estado]}
    />
  )
}

export function FilaDeKpis({ children }) {
  return (
    <div className="kpis" data-columnas={Children.count(children)} style={{ "--columnas": Children.count(children) }}>
      {children}
    </div>
  )
}
