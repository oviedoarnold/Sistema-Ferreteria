import { useMemo, useState } from "react"

import {
  PRODUCTOS_PRIORITARIOS,
  describirConteo,
  describirRiesgo,
  formatearUnidades,
  ordenarPorPrioridad,
} from "../../utils/proyeccion"

function FilaDeRecomendacion({ producto }) {
  const riesgo = describirRiesgo(producto.riesgo)

  return (
    <tr>
      <td>
        <span className="product-name">{producto.producto}</span>
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

  Recibe los productos ya filtrados por los filtros globales del Dashboard:
  "Ver todos" se refiere a ellos, no al total.
*/
function RecomendacionesInventario({ productos = [], hayFiltros = false }) {
  const [verTodos, setVerTodos] = useState(false)

  const ordenados = useMemo(() => ordenarPorPrioridad(productos), [productos])

  const visibles = verTodos ? ordenados : ordenados.slice(0, PRODUCTOS_PRIORITARIOS)
  const hayMas = ordenados.length > PRODUCTOS_PRIORITARIOS

  return (
    <div className="chart-wrap recomendaciones">
      <div className="recomendaciones-cabecera">
        <div className="chart-title">Recomendaciones de inventario</div>
        <p className="recomendaciones-conteo">
          {describirConteo({ hayFiltros, mostrados: visibles.length, total: ordenados.length })}
        </p>
      </div>

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

      {hayMas && (
        <button type="button" className="btn btn-secondary btn-sm ver-todos" onClick={() => setVerTodos((actual) => !actual)}>
          {verTodos ? `Ver solo ${PRODUCTOS_PRIORITARIOS}` : `Ver todos (${ordenados.length})`}
        </button>
      )}
    </div>
  )
}

export default RecomendacionesInventario
