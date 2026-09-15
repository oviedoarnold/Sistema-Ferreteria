import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import { crearSupabaseFalso } from "../test/supabaseFalso"
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
})
