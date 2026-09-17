/*
  Reglas de dibujo compartidas por las gráficas de barras del sistema.
*/

/*
  Altura de una barra como porcentaje de la más alta. Nunca menos de 4%: una
  barra en cero o casi cero tiene que seguir viéndose, porque su ausencia se
  confundiría con un dato que falta.
*/
export function alturaDeBarra(valor, maximo) {
  if (!(maximo > 0)) return 4

  return Math.max(4, Math.min(100, (Number(valor) / maximo) * 100))
}
