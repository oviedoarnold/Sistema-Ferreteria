let contadorDeRespaldo = 0

function hexAleatorio(bytes) {
  const valores = new Uint8Array(bytes)

  crypto.getRandomValues(valores)

  return Array.from(valores, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")
}

/*
  Math.random no sirve para identificadores: es predecible y en un
  mostrador con varias cajas dos ventas simultáneas podrían chocar.
  Se usa la fuente criptográfica del navegador.
*/
export function sufijoAleatorio(bytes = 6) {
  if (typeof crypto === "undefined") {
    contadorDeRespaldo += 1

    return `${Date.now().toString(36)}${contadorDeRespaldo.toString(36)}`
  }

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, bytes * 2)
  }

  return hexAleatorio(bytes)
}

export function crearId(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}-${sufijoAleatorio()}`
}
