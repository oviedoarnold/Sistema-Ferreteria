/*
  Reglas de dibujo compartidas por las gráficas del sistema.
*/

/*
  Largo de una barra como porcentaje del máximo, sirva para el alto de una
  columna o el ancho de una barra horizontal. Nunca menos de 4%: una barra en
  cero o casi cero tiene que seguir viéndose, porque su ausencia se
  confundiría con un dato que falta.
*/
export function largoDeBarra(valor, maximo) {
  if (!(maximo > 0)) return 4

  return Math.max(4, Math.min(100, (Number(valor) / maximo) * 100))
}

const PASOS_REDONDOS = [1, 2, 2.5, 5, 10]

/*
  Eje que empieza en cero y termina en un número redondo igual o mayor que el
  máximo, con unas cuatro marcas: 2,856 da 0, 1,000, 2,000 y 3,000.
*/
export function escalaDeEje(maximo, marcasBuscadas = 4) {
  if (!(maximo > 0)) return { tope: 1, marcas: [0, 1] }

  const pasoMinimo = maximo / marcasBuscadas
  const potencia = 10 ** Math.floor(Math.log10(pasoMinimo))
  const paso = PASOS_REDONDOS.map((factor) => factor * potencia).find((candidato) => candidato >= pasoMinimo)
  const tope = Math.ceil(maximo / paso) * paso
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, indice) => indice * paso)

  return { tope, marcas }
}

/*
  Arcos de una dona dibujada sobre una circunferencia de 100 unidades: cada
  segmento dice dónde empieza y cuánto mide. Entre segmentos queda un hueco
  pequeño para que dos colores vecinos no se fundan; con un solo segmento, el
  anillo queda completo.
*/
export function arcosDeDona(segmentos, hueco = 0.8) {
  const total = segmentos.reduce((suma, segmento) => suma + segmento.cantidad, 0)
  const conValor = segmentos.filter((segmento) => segmento.cantidad > 0).length
  const separacion = conValor > 1 ? hueco : 0

  return segmentos.reduce(
    ({ arcos, recorrido }, segmento) => {
      const completo = total > 0 ? (segmento.cantidad / total) * 100 : 0
      const largo = completo > 0 ? Math.max(0, completo - separacion) : 0

      return {
        arcos: [...arcos, { ...segmento, inicio: recorrido + separacion / 2, largo }],
        recorrido: recorrido + completo,
      }
    },
    { arcos: [], recorrido: 0 }
  ).arcos
}
