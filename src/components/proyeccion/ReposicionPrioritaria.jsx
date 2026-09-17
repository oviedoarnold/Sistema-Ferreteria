import BarrasHorizontales from "./BarrasHorizontales"
import {
  PRODUCTOS_PRIORITARIOS,
  describirCompra,
  detalleDeProducto,
  productosParaReponer,
} from "../../utils/proyeccion"

/* Los productos que más urge reponer: el mismo orden de prioridad que la tabla de detalle. */
function ReposicionPrioritaria({ productos }) {
  const filas = productosParaReponer(productos).map((producto) => ({
    clave: producto.producto_id,
    nombre: producto.producto,
    detalle: producto.codigo,
    valor: producto.recomendacion_compra,
    texto: describirCompra(producto),
    ayuda: detalleDeProducto(producto),
  }))

  return (
    <BarrasHorizontales
      titulo={`Prioridad de reposición — top ${PRODUCTOS_PRIORITARIOS}`}
      subtitulo="Unidades recomendadas, por riesgo y cantidad"
      filas={filas}
      vacio="Ningún producto de este filtro necesita reposición."
    />
  )
}

export default ReposicionPrioritaria
