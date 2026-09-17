import { largoDeBarra } from "../../utils/graficas"

function DetalleFlotante({ lineas }) {
  return (
    <span className="ayuda-flotante" role="tooltip">
      {lineas.map((linea) => (
        <span key={linea}>{linea}</span>
      ))}
    </span>
  )
}

function ContenidoDeFila({ fila, maximo }) {
  return (
    <>
      <span className="barra-h-cabecera">
        <span className="barra-h-nombre">
          {fila.nombre}
          {fila.detalle && <span className="barra-h-detalle">{fila.detalle}</span>}
        </span>
        <span className="barra-h-valor">{fila.texto}</span>
      </span>
      <span className="barra-h-pista" aria-hidden="true">
        <span className="barra-h-relleno" style={{ width: `${largoDeBarra(fila.valor, maximo)}%` }} />
      </span>
      {fila.ayuda && <DetalleFlotante lineas={fila.ayuda} />}
    </>
  )
}

/*
  Ranking en barras horizontales: los nombres largos se leen completos
  arriba de cada barra en lugar de cortarse debajo de una columna.

  Cada fila lleva su valor escrito; la barra solo lo dibuja, así que se oculta
  a los lectores de pantalla. Al pasar el mouse o llegar con el teclado, la
  fila muestra su detalle.

  Con onSeleccionar, cada fila es un botón que filtra el Dashboard por su
  clave; la fila elegida queda marcada y las demás se atenúan.
*/
function BarrasHorizontales({ titulo, subtitulo, filas, pie, vacio, seleccionada, onSeleccionar }) {
  const maximo = Math.max(0, ...filas.map((fila) => fila.valor))
  const haySeleccion = Boolean(onSeleccionar) && filas.some((fila) => fila.clave === seleccionada)

  return (
    <div className={`chart-wrap barras-h${haySeleccion ? " con-seleccion" : ""}`}>
      <div className="chart-title">{titulo}</div>
      {subtitulo && <p className="chart-subtitulo">{subtitulo}</p>}

      {filas.length === 0 ? (
        <p className="barras-h-vacio">{vacio}</p>
      ) : (
        <ol className="barras-h-lista" aria-label={titulo}>
          {filas.map((fila) => {
            const elegida = fila.clave === seleccionada

            return (
              <li key={fila.clave} className={`barra-h con-ayuda${elegida ? " elegida" : ""}`}>
                {onSeleccionar ? (
                  <button
                    type="button"
                    className="barra-h-boton"
                    aria-pressed={elegida}
                    onClick={() => onSeleccionar(fila.clave)}
                  >
                    <ContenidoDeFila fila={fila} maximo={maximo} />
                  </button>
                ) : (
                  <ContenidoDeFila fila={fila} maximo={maximo} />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {pie && filas.length > 0 && <p className="barras-h-pie">{pie}</p>}
    </div>
  )
}

export default BarrasHorizontales
