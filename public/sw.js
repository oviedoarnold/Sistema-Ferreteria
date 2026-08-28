/*
  Service Worker del Sistema Ferretería.

  Estrategia principal: stale-while-revalidate sobre los archivos propios.
  Se responde de inmediato con lo que hay en caché y en segundo plano se
  descarga la versión nueva para el próximo arranque. En un mostrador
  importa más abrir rápido que tener el último byte.

  Los datos del negocio no pasan por aquí: hoy viven en localStorage, que
  ya funciona sin conexión por sí mismo.
*/

const CACHE_NAME = "ferreteria-v1"

const ARCHIVOS_BASE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ARCHIVOS_BASE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre !== CACHE_NAME)
            .map((nombre) => caches.delete(nombre))
        )
      )
      .then(() => self.clients.claim())
  )
})

function esArchivoPropio(url) {
  return url.origin === self.location.origin
}

async function responderConCacheYActualizar(request) {
  const cache = await caches.open(CACHE_NAME)
  const enCache = await cache.match(request)

  const descarga = fetch(request)
    .then((respuesta) => {
      if (respuesta && respuesta.ok) {
        cache.put(request, respuesta.clone())
      }

      return respuesta
    })
    .catch(() => null)

  return enCache || (await descarga) || caches.match("/offline.html")
}

/*
  La navegación siempre resuelve al index: la aplicación es de una sola
  página y el enrutado ocurre en el navegador.
*/
async function responderNavegacion(request) {
  try {
    const respuesta = await fetch(request)
    const cache = await caches.open(CACHE_NAME)

    cache.put("/index.html", respuesta.clone())

    return respuesta
  } catch {
    const cache = await caches.open(CACHE_NAME)

    return (
      (await cache.match("/index.html")) ||
      (await cache.match("/offline.html"))
    )
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (!esArchivoPropio(url)) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(responderNavegacion(request))
    return
  }

  event.respondWith(responderConCacheYActualizar(request))
})
