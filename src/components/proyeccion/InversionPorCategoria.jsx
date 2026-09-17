import BarrasHorizontales from "./BarrasHorizontales"
import { formatMoney } from "../../utils/format"
import { contarProductos, inversionPorCategoria } from "../../utils/proyeccion"
import { roundMoney } from "../../utils/salesUtils"

/* En qué categorías se concentraría la inversión de reposición recomendada. */
function InversionPorCategoria({ productos }) {
  const categorias = inversionPorCategoria(productos)
  const total = roundMoney(categorias.reduce((suma, categoria) => suma + categoria.inversion, 0))

  const filas = categorias.map((categoria) => ({
    clave: categoria.categoria,
    nombre: categoria.categoria,
    detalle: contarProductos(categoria.productos),
    valor: categoria.inversion,
    texto: formatMoney(categoria.inversion),
  }))

  return (
    <BarrasHorizontales
      titulo="Inversión recomendada por categoría"
      subtitulo="A costo de compra, solo productos con reposición"
      filas={filas}
      pie={
        <>
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </>
      }
    />
  )
}

export default InversionPorCategoria
