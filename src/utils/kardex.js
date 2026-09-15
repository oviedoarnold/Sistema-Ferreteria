/*
  Cómo se lee un movimiento de inventario.

  Vive fuera de la pantalla porque son decisiones sobre los datos, no sobre
  el diseño: se prueban solas y la tabla queda sin condicionales dentro del
  JSX.
*/

export const TIPOS_DE_MOVIMIENTO = [
  { valor: "entrada", etiqueta: "Entrada" },
  { valor: "salida", etiqueta: "Salida" },
  { valor: "ajuste", etiqueta: "Ajuste" },
  { valor: "devolucion", etiqueta: "Devolución" },
]

/*
  Qué fue este movimiento, en las palabras del negocio.

  Se decide por el tipo y por la relación real con la venta, nunca leyendo
  el texto de "motivo". El motivo lo escribe una persona y cambia; la
  relación es un dato.

  Por eso una salida con venta es "Venta" y una sin venta es "Salida": la
  segunda es mercadería que se fue por otro camino —una merma, un traslado—
  y llamarla venta sería inventar un documento que no existe.
*/
export function etiquetaDeMovimiento(movimiento) {
  const tipo = movimiento?.tipo
  const tieneVenta = Boolean(movimiento?.venta_id)

  if (tipo === "salida") {
    return tieneVenta ? "Venta" : "Salida"
  }

  if (tipo === "devolucion") {
    return tieneVenta ? "Anulación" : "Devolución"
  }

  if (tipo === "entrada") return "Entrada"
  if (tipo === "ajuste") return "Ajuste"

  return "Movimiento"
}

/*
  Reparte la cantidad entre las columnas Entrada y Salida.

  Manda el signo y no el tipo: un ajuste puede ser de cualquiera de los dos
  lados —corregir un conteo hacia arriba o hacia abajo— y decidirlo por el
  tipo lo pondría siempre en la misma columna, con el signo contradiciendo
  a la columna que lo contiene.
*/
export function entradaYSalida(movimiento) {
  const cantidad = Number(movimiento?.cantidad) || 0

  return {
    entrada: cantidad > 0 ? cantidad : null,
    salida: cantidad < 0 ? Math.abs(cantidad) : null,
  }
}

/*
  El documento que respalda el movimiento. Solo el número de factura: el
  identificador interno no le dice nada a nadie.
*/
export function documentoDe(movimiento) {
  return movimiento?.numero_factura || null
}
