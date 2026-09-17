const AVISOS = {
  cargando: { rol: "status", texto: () => "Cargando proyección de demanda…" },
  error: { rol: "alert", texto: (prediccion) => prediccion.error },
  vacio: { rol: "status", texto: () => "No hay productos que coincidan con los filtros seleccionados." },
}

/*
  Donde va contenido de la proyección. Si el archivo no cargó, o los filtros
  no dejan productos, ocupa el mismo lugar con un aviso y sin cifras; la
  operación alrededor sigue igual.
*/
function ZonaPredictiva({ prediccion, className = "", children }) {
  if (prediccion.estado === "listo") return children(prediccion.analisis)

  const aviso = AVISOS[prediccion.estado]

  return (
    <div className={`chart-wrap zona-aviso ${className}`} role={aviso.rol}>
      {aviso.texto(prediccion)}
    </div>
  )
}

export default ZonaPredictiva
