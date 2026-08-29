const LARGO_MAXIMO_TEXTO = 2000

/*
  Quita caracteres de control y recorta el largo antes de persistir.
  Nada de lo que captura el sistema los necesita, y evitan que un valor
  pegado desde otra aplicación ensucie los PDF o los reportes.
*/
const CODIGO_ESPACIO = 31
const CODIGO_SUPRIMIR = 127

function esCaracterImprimible(caracter) {
  const codigo = caracter.codePointAt(0)

  return codigo > CODIGO_ESPACIO && codigo !== CODIGO_SUPRIMIR
}

function limpiarTexto(texto) {
  return Array.from(texto.slice(0, LARGO_MAXIMO_TEXTO))
    .filter(esCaracterImprimible)
    .join("")
}

function limpiarValor(valor) {
  if (typeof valor === "string") {
    return limpiarTexto(valor)
  }

  if (Array.isArray(valor)) {
    return valor.map(limpiarValor)
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, contenido]) => [
        limpiarTexto(clave),
        limpiarValor(contenido),
      ])
    )
  }

  return valor
}

/*
  El almacenamiento puede fallar: cuota llena, modo privado o bloqueado
  por el navegador. Antes esas excepciones tumbaban la aplicación.
*/
export function guardarJSON(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(limpiarValor(valor)))

    return true
  } catch (error) {
    console.error(`No se pudo guardar "${clave}":`, error)

    return false
  }
}

export function leerJSON(clave, porDefecto = null) {
  try {
    const guardado = localStorage.getItem(clave)

    return guardado ? JSON.parse(guardado) : porDefecto
  } catch (error) {
    console.error(`No se pudo leer "${clave}":`, error)

    return porDefecto
  }
}

export function guardarTexto(clave, valor) {
  try {
    localStorage.setItem(clave, limpiarTexto(String(valor ?? "")))

    return true
  } catch (error) {
    console.error(`No se pudo guardar "${clave}":`, error)

    return false
  }
}

export function leerTexto(clave, porDefecto = null) {
  try {
    return localStorage.getItem(clave) ?? porDefecto
  } catch (error) {
    console.error(`No se pudo leer "${clave}":`, error)

    return porDefecto
  }
}

export function borrar(clave) {
  try {
    localStorage.removeItem(clave)

    return true
  } catch (error) {
    console.error(`No se pudo borrar "${clave}":`, error)

    return false
  }
}
