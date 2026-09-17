import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { config as middleware } from "../../middleware.js"

/*
  Cada pantalla existe en dos lugares: en el mapa de rutas de React y en la
  configuración de Vercel. React solo resuelve una dirección cuando la
  aplicación ya cargó; si alguien entra directo o recarga la página, es Vercel
  quien decide qué servir.

  /kardex y /analytics quedaron fuera de vercel.json: navegando dentro de la
  aplicación funcionaban, pero al recargar respondían 404. Esta prueba
  compara las dos listas para que una ruta nueva no vuelva a quedar a medias.
*/

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

const vercel = JSON.parse(readFileSync(join(raiz, "vercel.json"), "utf8"))
const router = readFileSync(join(raiz, "src", "routes", "AppRouter.jsx"), "utf8")

const RUTAS_CON_ARCHIVO_PROPIO = new Set(["/", "/login", "*"])

const rutasDelRouter = router
  .split(/<Route\s/)
  .slice(1)
  .map((bloque) => ({
    ruta: bloque.match(/path="([^"]+)"/)[1],
    privada: bloque.includes("<ProtectedRoute"),
  }))

const rutasDeLaAplicacion = rutasDelRouter.filter(({ ruta }) => !RUTAS_CON_ARCHIVO_PROPIO.has(ruta))

const reescrituraQueSirve = (ruta) =>
  vercel.rewrites.find(({ source }) => new RegExp(`^${source}$`).test(ruta))

describe("rutas del despliegue", () => {
  it("encuentra las rutas del mapa, para no pasar sin revisar nada", () => {
    expect(rutasDeLaAplicacion.map(({ ruta }) => ruta)).toEqual(
      expect.arrayContaining(["/dashboard", "/analytics", "/kardex"])
    )
  })

  it.each(rutasDeLaAplicacion.map(({ ruta }) => ruta))("Vercel sirve la aplicación al entrar directo a %s", (ruta) => {
    expect(reescrituraQueSirve(ruta)?.destination).toBe("/index.html")
  })

  it.each(rutasDelRouter.filter(({ privada }) => privada).map(({ ruta }) => ruta))(
    "el middleware pide sesión para %s",
    (ruta) => {
      expect(middleware.matcher).toContain(ruta)
    }
  )
})
