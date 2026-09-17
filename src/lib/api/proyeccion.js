/*
  Carga la proyección de demanda que publica el pipeline de Ciencia de Datos.

  Es un archivo estático que genera data-science/src/export_dashboard.py, no
  una consulta a Supabase: las ventas simuladas y los productos sintéticos del
  análisis no pertenecen a los datos de la operación y no entran a la base.
*/

export const RUTA_PROYECCION = "/data/predicciones-inventario.json"

export const MENSAJE_SIN_PROYECCION = "No fue posible cargar la proyección de demanda."

/*
  Se comprueba la forma antes de entregarla. Un archivo a medio escribir o de
  otra versión no debe llegar a la pantalla como una tabla vacía que parezca
  "no hay nada que comprar".
*/
// typeof null también es "object": sin esta comprobación, un campo en null pasaría.
const esObjeto = (valor) => valor !== null && typeof valor === "object"

function esProyeccionValida(datos) {
  return (
    esObjeto(datos) &&
    esObjeto(datos.metadata) &&
    esObjeto(datos.resumen) &&
    Array.isArray(datos.serie_mensual) &&
    Array.isArray(datos.productos) &&
    datos.productos.length > 0
  )
}

export async function traerProyeccion({ ruta = RUTA_PROYECCION } = {}) {
  let respuesta

  try {
    respuesta = await fetch(ruta)
  } catch (problema) {
    console.error("No se pudo descargar la proyección:", problema)
    throw new Error(MENSAJE_SIN_PROYECCION, { cause: problema })
  }

  if (!respuesta.ok) {
    console.error(`La proyección respondió ${respuesta.status}.`)
    throw new Error(MENSAJE_SIN_PROYECCION)
  }

  let datos

  try {
    datos = await respuesta.json()
  } catch (problema) {
    console.error("La proyección no es un JSON válido:", problema)
    throw new Error(MENSAJE_SIN_PROYECCION, { cause: problema })
  }

  if (!esProyeccionValida(datos)) {
    console.error("La proyección no tiene la forma esperada.")
    throw new Error(MENSAJE_SIN_PROYECCION)
  }

  return datos
}
