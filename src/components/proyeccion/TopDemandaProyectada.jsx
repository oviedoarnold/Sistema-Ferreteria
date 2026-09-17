import BarrasHorizontales from "./BarrasHorizontales"
import {
  PRODUCTOS_EN_TOP_DEMANDA,
  detalleDeProducto,
  formatearUnidades,
  mayorDemandaProyectada,
} from "../../utils/proyeccion"

/* Los productos que más se espera vender en 30 días, según la predicción del modelo. */
function TopDemandaProyectada({ productos, limite = PRODUCTOS_EN_TOP_DEMANDA }) {
  const filas = mayorDemandaProyectada(productos, limite).map((producto) => ({
    clave: producto.producto_id,
    nombre: producto.producto,
    detalle: producto.codigo,
    valor: producto.demanda_predicha_30d,
    texto: `${formatearUnidades(producto.demanda_predicha_30d)} u.`,
    ayuda: detalleDeProducto(producto),
  }))

  return (
    <BarrasHorizontales
      titulo={`Top ${limite} demanda proyectada — 30 días`}
      subtitulo="Unidades previstas para los próximos 30 días"
      filas={filas}
    />
  )
}

export default TopDemandaProyectada
