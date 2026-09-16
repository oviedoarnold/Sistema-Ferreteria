import { useMemo, useState } from "react"

import {
  FILTROS_DE_RIESGO,
  PRODUCTOS_PRIORITARIOS,
  describirRiesgo,
  esProductoSimulado,
  filtrarPorRiesgo,
  formatearUnidades,
  ordenarPorPrioridad,
} from "../../utils/proyeccion"

function FilaDeRecomendacion({ producto }) {
  const riesgo = describirRiesgo(producto.riesgo)
  const simulado = esProductoSimulado(producto)

  return (
    <tr>
      <td>
        <span className="product-name">
          {producto.producto}
          <span className={`origen-producto ${simulado ? "origen-simulado" : "origen-sistema"}`}>
            {simulado ? "Simulado" : "Sistema"}
          </span>
        </span>
        <span className="product-cat">{producto.codigo}</span>
      </td>
      <td>{producto.categoria}</td>
      <td className="num">{formatearUnidades(producto.stock_actual, 0)}</td>
      <td className="num">{formatearUnidades(producto.demanda_predicha_7d)}</td>
      <td className="num">{formatearUnidades(producto.demanda_predicha_30d)}</td>
      <td>
        <span className={`badge ${riesgo.clase}`}>
          <span className="badge-dot" />
          {riesgo.etiqueta}
        </span>
      </td>
      <td className="num recomendacion">
        {producto.recomendacion_compra > 0
          ? `Comprar ${formatearUnidades(producto.recomendacion_compra, 0)}`
          : "Sin compra"}
      </td>
    </tr>
  )
}

/*
  Por omisión, solo los diez que más urge atender. Cincuenta filas de golpe
  entierran justo lo importante; el resto queda a un clic.
*/
function RecomendacionesInventario({ productos = [] }) {
  const [riesgo, setRiesgo] = useState("todos")
  const [verTodos, setVerTodos] = useState(false)

  const filtrados = useMemo(
    () => ordenarPorPrioridad(filtrarPorRiesgo(productos, riesgo)),
    [productos, riesgo]
  )

  const visibles = verTodos ? filtrados : filtrados.slice(0, PRODUCTOS_PRIORITARIOS)
  const hayMas = filtrados.length > PRODUCTOS_PRIORITARIOS

  return (
    <div className="chart-wrap recomendaciones">
      <div className="recomendaciones-cabecera">
        <div className="chart-title">Recomendaciones de inventario</div>

        <div className="filtros-riesgo" role="group" aria-label="Filtrar por riesgo">
          {FILTROS_DE_RIESGO.map((filtro) => (
            <button
              key={filtro.valor}
              type="button"
              className={`btn btn-sm ${riesgo === filtro.valor ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={riesgo === filtro.valor}
              onClick={() => setRiesgo(filtro.valor)}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <p className="recomendaciones-conteo">
        {verTodos || !hayMas
          ? `${filtrados.length} productos`
          : `${PRODUCTOS_PRIORITARIOS} prioritarios de ${filtrados.length}`}
      </p>

      {filtrados.length === 0 ? (
        <div className="empty-state">Ningún producto con ese nivel de riesgo</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Stock</th>
                <th className="num">Demanda 7d</th>
                <th className="num">Demanda 30d</th>
                <th>Riesgo</th>
                <th className="num">Recomendación</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((producto) => (
                <FilaDeRecomendacion key={producto.producto_id} producto={producto} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hayMas && (
        <button type="button" className="btn btn-secondary btn-sm ver-todos" onClick={() => setVerTodos((actual) => !actual)}>
          {verTodos ? `Ver solo los ${PRODUCTOS_PRIORITARIOS} prioritarios` : `Ver todos (${filtrados.length})`}
        </button>
      )}
    </div>
  )
}

export default RecomendacionesInventario
