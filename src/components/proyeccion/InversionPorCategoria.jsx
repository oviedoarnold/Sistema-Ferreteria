import BarrasHorizontales from "./BarrasHorizontales"
import { formatMoney } from "../../utils/format"
import { contarProductos, inversionPorCategoria } from "../../utils/proyeccion"
import { roundMoney } from "../../utils/salesUtils"

/*
  En qué categorías se concentraría la inversión de reposición recomendada.
  Cada barra filtra el Dashboard por su categoría; un segundo clic la quita.
*/
function InversionPorCategoria({ productos, seleccionada, onSeleccionar }) {
  const categorias = inversionPorCategoria(productos)
  const total = roundMoney(categorias.reduce((suma, categoria) => suma + categoria.inversion, 0))

  const filas = categorias.map((categoria) => ({
    clave: categoria.categoria,
    nombre: categoria.categoria,
    detalle: contarProductos(categoria.productos),
    valor: categoria.inversion,
    texto: formatMoney(categoria.inversion),
    ayuda: [
      categoria.categoria,
      `Inversión: ${formatMoney(categoria.inversion)}`,
      `Con reposición: ${contarProductos(categoria.productos)}`,
    ],
  }))

  return (
    <BarrasHorizontales
      titulo="Inversión recomendada por categoría"
      subtitulo="A costo de compra · elige una categoría para filtrar"
      filas={filas}
      vacio="Ningún producto de este filtro necesita reposición."
      seleccionada={seleccionada}
      onSeleccionar={onSeleccionar}
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
