import { useContext, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { ProductContext } from "../context/contexts"
import { traerKardex, FILAS_POR_PAGINA } from "../lib/api/kardex"

import {
  etiquetaDeMovimiento,
  entradaYSalida,
  documentoDe,
  TIPOS_DE_MOVIMIENTO,
} from "../utils/kardex"

const SIN_FILTROS = {
  busqueda: "",
  productoId: "",
  tipo: "",
  desde: "",
  hasta: "",
}

const fechaLegible = (iso) =>
  new Date(iso).toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/*
  Una fila del libro. Se mantiene aparte para que la tabla no lleve
  condicionales dentro del JSX: qué fue el movimiento y en qué columna cae
  su cantidad ya lo decidieron las utilidades.
*/
function FilaDeMovimiento({ movimiento }) {
  const { entrada, salida } = entradaYSalida(movimiento)
  const documento = documentoDe(movimiento)

  return (
    <tr>
      <td className="kardex-fecha">{fechaLegible(movimiento.fecha)}</td>

      <td>
        <span className="product-name">{movimiento.producto}</span>
        <span className="product-cat">{movimiento.codigo || "—"}</span>
      </td>

      <td>
        <span className={`badge badge-mov-${movimiento.tipo}`}>
          {etiquetaDeMovimiento(movimiento)}
        </span>
      </td>

      <td className="kardex-documento">{documento || "—"}</td>
      <td className="kardex-motivo">{movimiento.motivo || "—"}</td>

      <td className="num kardex-entrada">{entrada ?? "—"}</td>
      <td className="num kardex-salida">{salida ?? "—"}</td>
      <td className="num kardex-saldo">{movimiento.saldo}</td>

      <td>{movimiento.usuario || "—"}</td>
    </tr>
  )
}

function Kardex() {
  const { products = [] } = useContext(ProductContext)
  const [parametros, setParametros] = useSearchParams()

  /*
    El producto puede venir en la dirección, desde el botón del inventario.
    Solo siembra el valor inicial: a partir de ahí manda el filtro, para que
    el usuario pueda quitarlo sin que la URL se lo vuelva a poner.
  */
  const [filtros, setFiltros] = useState(() => ({
    ...SIN_FILTROS,
    productoId: parametros.get("producto") || "",
  }))

  const [pagina, setPagina] = useState(1)

  /*
    Lo que se pidió y lo que llegó, por separado.

    "Cargando" no es una bandera que alguien enciende y apaga: es que lo que
    hay en pantalla todavía no corresponde a lo que se pidió. Derivarlo así
    evita encender la bandera dentro del efecto —lo que React desaconseja
    por los renders en cascada— y de paso no puede quedarse encendida si una
    respuesta se pierde.
  */
  const consulta = useMemo(
    () => ({ filtros, pagina }),
    [filtros, pagina]
  )

  const [resultado, setResultado] = useState({
    filas: [],
    total: 0,
    error: "",
    consulta: null,
  })

  const cargando = resultado.consulta !== consulta
  const { filas: movimientos, total, error } = resultado

  useEffect(() => {
    let vigente = true

    traerKardex(consulta)
      .then(({ filas, total: cuantos }) => {
        if (vigente) {
          setResultado({ filas, total: cuantos, error: "", consulta })
        }
      })
      .catch((problema) => {
        if (vigente) {
          setResultado({
            filas: [],
            total: 0,
            error: problema.message,
            consulta,
          })
        }
      })

    return () => {
      vigente = false
    }
  }, [consulta])

  /*
    Cambiar un filtro vuelve a la primera página: quedarse en la página
    cuatro de un resultado que ahora tiene dos deja la pantalla en blanco
    sin explicación.
  */
  const cambiarFiltro = (campo, valor) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor }))
    setPagina(1)

    if (campo === "productoId") {
      parametros.delete("producto")
      setParametros(parametros, { replace: true })
    }
  }

  const limpiarFiltros = () => {
    setFiltros(SIN_FILTROS)
    setPagina(1)
    parametros.delete("producto")
    setParametros(parametros, { replace: true })
  }

  const hayFiltros = useMemo(
    () => Object.values(filtros).some(Boolean),
    [filtros]
  )

  const paginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA))
  const esPrimera = pagina <= 1
  const esUltima = pagina >= paginas

  return (
    <div className="view active">
      <div className="view-header">
        <div>
          <h2>Kardex de Inventario</h2>

          <p className="sub">
            Cada entrada, salida y ajuste, con el saldo que dejó
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="toolbar">
        <div className="search-box">
          <input
            type="search"
            placeholder="Buscar por producto o código"
            value={filtros.busqueda}
            onChange={(e) => cambiarFiltro("busqueda", e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          aria-label="Producto"
          value={filtros.productoId}
          onChange={(e) => cambiarFiltro("productoId", e.target.value)}
        >
          <option value="">Todos los productos</option>

          {products.map((producto) => (
            <option key={producto.id} value={producto.id}>
              {producto.name}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          aria-label="Tipo de movimiento"
          value={filtros.tipo}
          onChange={(e) => cambiarFiltro("tipo", e.target.value)}
        >
          <option value="">Todos los movimientos</option>

          {TIPOS_DE_MOVIMIENTO.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="filter-select"
          aria-label="Desde"
          value={filtros.desde}
          onChange={(e) => cambiarFiltro("desde", e.target.value)}
        />

        <input
          type="date"
          className="filter-select"
          aria-label="Hasta"
          value={filtros.hasta}
          onChange={(e) => cambiarFiltro("hasta", e.target.value)}
        />

        {hayFiltros && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="empty-state">
          <strong>{error}</strong>

          <p>Vuelve a intentarlo en un momento.</p>
        </div>
      )}

      {!error && cargando && (
        <div className="empty-state">Cargando movimientos…</div>
      )}

      {!error && !cargando && movimientos.length === 0 && (
        <div className="empty-state">
          <strong>
            {hayFiltros
              ? "Ningún movimiento coincide con el filtro"
              : "Todavía no hay movimientos registrados"}
          </strong>
        </div>
      )}

      {!error && !cargando && movimientos.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th>Documento</th>
                  <th>Motivo</th>
                  <th className="num">Entrada</th>
                  <th className="num">Salida</th>
                  <th className="num">Saldo</th>
                  <th>Usuario</th>
                </tr>
              </thead>

              <tbody>
                {movimientos.map((movimiento) => (
                  <FilaDeMovimiento
                    key={movimiento.id}
                    movimiento={movimiento}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="paginacion">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={esPrimera}
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
            >
              Anterior
            </button>

            <span className="paginacion-estado">
              Página {pagina} de {paginas} · {total} movimientos
            </span>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={esUltima}
              onClick={() => setPagina((actual) => Math.min(paginas, actual + 1))}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Kardex
