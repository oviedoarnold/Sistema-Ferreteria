import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import { ClientsContext, ProductContext, SalesContext } from "../context/contexts"
import { PERMISSIONS } from "../context/permissions"
import { crearSupabaseFalso } from "../test/supabaseFalso"
import { montarSupabaseFalso, permisosDe, sesionDe, usuarioDePrueba } from "../test/auth"
import { servirProyeccion } from "../test/proyeccionDePrueba"
import AppRouter from "./AppRouter"

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
}))

/*
  El mapa de rutas no lo ejercitaba ninguna prueba: cada pantalla se montaba
  suelta. Eso dejaba sin cubrir justo el punto donde se decide con qué
  permiso se protege cada dirección, que es un error silencioso —la pantalla
  funciona, pero la protege el permiso equivocado—.

  Aquí se comprueba el mapa, no las pantallas.
*/

const irA = (ruta) => {
  window.history.pushState({}, "", ruta)
}

/*
  Los proveedores viven en main.jsx, por encima del router. Aquí se monta
  solo el de sesión, que es del que dependen las rutas protegidas; las
  pantallas privadas no llegan a renderizarse sin sesión.
*/
const montarRouter = () =>
  render(
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )

beforeEach(() => {
  globalThis.__supabaseFalso = crearSupabaseFalso({
    tablas: { empresas: [], usuarios: [] },
    sesionInicial: null,
  })
})

describe("mapa de rutas", () => {
  it("la raíz es pública", async () => {
    irA("/")

    montarRouter()

    expect(
      await screen.findAllByText("Sistema Ferretería")
    ).not.toHaveLength(0)
  })

  it("una dirección que no existe cae en la pantalla de 404", async () => {
    irA("/ruta-que-no-existe")

    montarRouter()

    expect(await screen.findByText(/404/)).toBeInTheDocument()
  })

  /*
    Sin sesión, cualquier ruta privada manda al login. Se comprueba sobre
    /kardex porque es la que se acaba de agregar: si quedara fuera de
    ProtectedRoute, el libro de inventario sería público.
  */
  it("el kardex no se abre sin sesión", async () => {
    irA("/kardex")

    montarRouter()

    await waitFor(() =>
      expect(window.location.pathname).toBe("/login")
    )
  })

  it("el inventario tampoco", async () => {
    irA("/products")

    montarRouter()

    await waitFor(() =>
      expect(window.location.pathname).toBe("/login")
    )
  })

  it("Analítica Predictiva tampoco", async () => {
    irA("/analytics")

    montarRouter()

    await waitFor(() =>
      expect(window.location.pathname).toBe("/login")
    )
  })
})

/*
  Con sesión, lo que importa es con qué permiso quedó protegida la ruta en el
  mapa real. Los datos de la operación se simulan vacíos: aquí no se prueban
  las pantallas.
*/
describe("Analítica Predictiva en el mapa de rutas", () => {
  const conSesion = (secciones) =>
    montarSupabaseFalso({
      usuarios: [usuarioDePrueba()],
      permisos: permisosDe("u-1", secciones),
      sesionInicial: sesionDe("auth-1"),
    })

  const montarConDatosVacios = () =>
    render(
      <AuthProvider>
        <ProductContext.Provider value={{ products: [], company: { name: "Ferretería de prueba" } }}>
          <ClientsContext.Provider value={{ clients: [] }}>
            <SalesContext.Provider value={{ sales: [] }}>
              <AppRouter />
            </SalesContext.Provider>
          </ClientsContext.Provider>
        </ProductContext.Provider>
      </AuthProvider>
    )

  beforeEach(() => {
    servirProyeccion(vi)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("abre para quien tiene permiso de inventario", async () => {
    conSesion([PERMISSIONS.PRODUCTS])
    irA("/analytics")

    montarConDatosVacios()

    expect(await screen.findByRole("heading", { name: "Analítica Predictiva" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/analytics")
  })

  it("no abre para quien solo puede ver el Dashboard", async () => {
    conSesion([PERMISSIONS.DASHBOARD])
    irA("/analytics")

    montarConDatosVacios()

    await waitFor(() =>
      expect(window.location.pathname).toBe("/dashboard")
    )
    expect(screen.queryByRole("heading", { name: "Analítica Predictiva" })).not.toBeInTheDocument()
  })
})
