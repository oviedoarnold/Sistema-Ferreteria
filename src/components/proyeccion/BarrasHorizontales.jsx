import { largoDeBarra } from "../../utils/graficas"

/*
  Ranking en barras horizontales: los nombres largos se leen completos
  arriba de cada barra en lugar de cortarse debajo de una columna.

  Cada fila lleva su valor escrito; la barra solo lo dibuja, así que se oculta
  a los lectores de pantalla. La lista es ordenada porque el orden es el dato.
*/
function BarrasHorizontales({ titulo, subtitulo, filas, pie }) {
  const maximo = Math.max(0, ...filas.map((fila) => fila.valor))

  return (
    <div className="chart-wrap barras-h">
      <div className="chart-title">{titulo}</div>
      {subtitulo && <p className="chart-subtitulo">{subtitulo}</p>}

      <ol className="barras-h-lista" aria-label={titulo}>
        {filas.map((fila) => (
          <li key={fila.clave} className="barra-h" title={`${fila.nombre}: ${fila.texto}`}>
            <div className="barra-h-cabecera">
              <span className="barra-h-nombre">
                {fila.nombre}
                {fila.detalle && <span className="barra-h-detalle">{fila.detalle}</span>}
              </span>
              <span className="barra-h-valor">{fila.texto}</span>
            </div>
            <div className="barra-h-pista" aria-hidden="true">
              <div className="barra-h-relleno" style={{ width: `${largoDeBarra(fila.valor, maximo)}%` }} />
            </div>
          </li>
        ))}
      </ol>

      {pie && <p className="barras-h-pie">{pie}</p>}
    </div>
  )
}

export default BarrasHorizontales
