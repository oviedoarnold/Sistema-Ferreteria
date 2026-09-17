import BarrasHorizontales from "./BarrasHorizontales"
import {
  PRODUCTOS_EN_TOP_DEMANDA,
  describirRiesgo,
  formatearUnidades,
  mayorDemandaProyectada,
} from "../../utils/proyeccion"

const describirCompra = (producto) =>
  producto.recomendacion_compra > 0
    ? `Comprar ${formatearUnidades(producto.recomendacion_compra, 0)}`
    : "Sin compra"

/* Los productos que más se espera vender en 30 días, según la predicción del modelo. */
function TopDemandaProyectada({ productos }) {
  const filas = mayorDemandaProyectada(productos).map((producto) => ({
    clave: producto.producto_id,
    nombre: producto.producto,
    detalle: producto.codigo,
    valor: producto.demanda_predicha_30d,
    texto: `${formatearUnidades(producto.demanda_predicha_30d)} u.`,
    ayuda: [
      `${producto.producto} · ${producto.codigo}`,
      `Demanda 7 días: ${formatearUnidades(producto.demanda_predicha_7d)} u.`,
      `Demanda 30 días: ${formatearUnidades(producto.demanda_predicha_30d)} u.`,
      `Stock: ${formatearUnidades(producto.stock_actual, 0)}`,
      `Riesgo: ${describirRiesgo(producto.riesgo).etiqueta}`,
      `Recomendación: ${describirCompra(producto)}`,
    ],
  }))

  return (
    <BarrasHorizontales
      titulo={`Top ${PRODUCTOS_EN_TOP_DEMANDA} demanda proyectada — 30 días`}
      subtitulo="Unidades previstas para los próximos 30 días"
      filas={filas}
    />
  )
}

export default TopDemandaProyectada
