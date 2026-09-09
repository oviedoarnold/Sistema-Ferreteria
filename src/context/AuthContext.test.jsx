import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

import { crearSupabaseFalso } from "../test/supabaseFalso"

const EMPRESA = "empresa-1"

const DATOS_BASE = {
  usuarios: [
    {
      id: "u-admin",
      auth_id: "auth-admin",
      empresa_id: EMPRESA,
      email: "admin@ferreteria.test",
      nombre: "Administradora",
      rol: "admin",
      activo: true,
      entro_en: "2026-01-01",
    },
    {
      id: "u-vendedor",
      auth_id: "auth-vendedor",
      empresa_id: EMPRESA,
      email: "vendedor@ferreteria.test",
      nombre: "Vendedor de mostrador",
      rol: "vendedor",
      activo: true,
      entro_en: "2026-01-02",
    },
    {
      id: "u-invitado",
      auth_id: null,
      empresa_id: EMPRESA,
      email: "invitado@ferreteria.test",
      nombre: "Aún no entra",
      rol: "vendedor",
      activo: true,
      entro_en: null,
    },
  ],
  permisos_usuario: [
    { usuario_id: "u-vendedor", empresa_id: EMPRESA, seccion: "pos" },
    { usuario_id: "u-vendedor", empresa_id: EMPRESA, seccion: "sales-history" },
    { usuario_id: "u-admin", empresa_id: EMPRESA, seccion: "settings" },
  ],
}

const CUENTAS = [
  { id: "auth-admin", email: "admin@ferreteria.test", password: "Admin2026" },
  { id: "auth-vendedor", email: "vendedor@ferreteria.test", password: "Vende2026" },
  { id: "auth-huerfano", email: "huerfano@ferreteria.test", password: "Huerf2026" },
]

let falso

vi.mock("../lib/supabase", () => ({
  get supabase() {
    return globalThis.__supabaseFalso
  },
  hayConexionConfigurada: true,
  exigirSupabase: () => globalThis.__supabaseFalso,
}))

async function renderAuth({ sesionInicial = null, tablas = DATOS_BASE } = {}) {
  falso = crearSupabaseFalso({ tablas, cuentas: CUENTAS, sesionInicial })
  globalThis.__supabaseFalso = falso

  const { AuthProvider } = await import("./AuthContext")
  const { useAuth } = await import("../hooks/useAuth")

  const vista = renderHook(() => useAuth(), { wrapper: AuthProvider })

  await waitFor(() => expect(vista.result.current.cargando).toBe(false))

  return vista
}

beforeEach(() => {
  vi.resetModules()
})

describe("sesión inicial", () => {
  it("arranca sin usuario cuando no hay sesión", async () => {
    const { result } = await renderAuth()

    expect(result.current.user).toBeNull()
  })

  it("deja de cargar aunque no haya sesión", async () => {
    const { result } = await renderAuth()

    expect(result.current.cargando).toBe(false)
  })

  it("recupera la sesión guardada al arrancar", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-vendedor" } },
    })

    expect(result.current.user.name).toBe("Vendedor de mostrador")
  })

  it("no da acceso a una cuenta que nadie invitó", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-huerfano" } },
    })

    expect(result.current.user).toBeNull()
  })

  it("no da acceso a un usuario desactivado", async () => {
    const tablas = {
      ...DATOS_BASE,
      usuarios: DATOS_BASE.usuarios.map((u) =>
        u.id === "u-vendedor" ? { ...u, activo: false } : u
      ),
    }

    const { result } = await renderAuth({
      tablas,
      sesionInicial: { user: { id: "auth-vendedor" } },
    })

    expect(result.current.user).toBeNull()
  })
})

describe("login", () => {
  it("acepta las credenciales correctas", async () => {
    const { result } = await renderAuth()

    let respuesta
    await act(async () => {
      respuesta = await result.current.login(
        "vendedor@ferreteria.test",
        "Vende2026"
      )
    })

    expect(respuesta.ok).toBe(true)
    expect(result.current.user.name).toBe("Vendedor de mostrador")
  })

  it("rechaza una contraseña incorrecta", async () => {
    const { result } = await renderAuth()

    let respuesta
    await act(async () => {
      respuesta = await result.current.login(
        "vendedor@ferreteria.test",
        "equivocada"
      )
    })

    expect(respuesta.ok).toBe(false)
    expect(respuesta.mensaje).toMatch(/incorrect/i)
    expect(result.current.user).toBeNull()
  })

  it("ignora mayúsculas y espacios en el correo", async () => {
    const { result } = await renderAuth()

    let respuesta
    await act(async () => {
      respuesta = await result.current.login(
        "  VENDEDOR@Ferreteria.TEST  ",
        "Vende2026"
      )
    })

    expect(respuesta.ok).toBe(true)
  })

  it("explica cuándo la cuenta no está asignada a una ferretería", async () => {
    const { result } = await renderAuth()

    let respuesta
    await act(async () => {
      respuesta = await result.current.login(
        "huerfano@ferreteria.test",
        "Huerf2026"
      )
    })

    expect(respuesta.ok).toBe(false)
    expect(respuesta.mensaje).toMatch(/no está asignada/i)
  })

  it("cierra la sesión de la cuenta sin asignar, para no dejarla a medias", async () => {
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.login("huerfano@ferreteria.test", "Huerf2026")
    })

    expect(falso.auth.signOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})

describe("logout", () => {
  it("cierra la sesión", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-vendedor" } },
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(falso.auth.signOut).toHaveBeenCalled()
  })
})

describe("hasPermission", () => {
  it("niega todo sin sesión", async () => {
    const { result } = await renderAuth()

    expect(result.current.hasPermission("pos")).toBe(false)
  })

  it("el vendedor solo tiene lo que se le habilitó", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-vendedor" } },
    })

    expect(result.current.hasPermission("pos")).toBe(true)
    expect(result.current.hasPermission("sales-history")).toBe(true)
    expect(result.current.hasPermission("products")).toBe(false)
    expect(result.current.hasPermission("settings")).toBe(false)
  })

  it("el administrador tiene acceso a todo aunque su lista sea corta", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    expect(result.current.hasPermission("products")).toBe(true)
    expect(result.current.hasPermission("suppliers")).toBe(true)
    expect(result.current.isAdmin).toBe(true)
  })
})

describe("administración de usuarios", () => {
  it("lista los usuarios de la empresa", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await waitFor(() => expect(result.current.users.length).toBe(3))
  })

  it("marca quién todavía no acepta la invitación", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await waitFor(() => expect(result.current.users.length).toBe(3))

    const pendiente = result.current.users.find(
      (u) => u.email === "invitado@ferreteria.test"
    )

    expect(pendiente.aceptoInvitacion).toBe(false)
  })

  it("no muestra usuarios sin sesión", async () => {
    const { result } = await renderAuth()

    expect(result.current.users).toEqual([])
  })

  it("invita a un usuario nuevo por correo", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await act(async () => {
      await result.current.addUser({
        name: "Nuevo Cajero",
        email: "  NUEVO@ferreteria.test ",
        role: "vendedor",
        permissions: ["pos"],
      })
    })

    const creado = falso.datos.usuarios.find(
      (u) => u.email === "nuevo@ferreteria.test"
    )

    expect(creado).toBeTruthy()
    expect(creado.nombre).toBe("Nuevo Cajero")
  })

  it("exige nombre", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await expect(
      result.current.addUser({ name: "  ", email: "x@y.test" })
    ).rejects.toThrow(/nombre/i)
  })

  it("exige un correo válido", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await expect(
      result.current.addUser({ name: "Alguien", email: "no-es-correo" })
    ).rejects.toThrow(/correo/i)
  })

  it("desactivar a alguien lo marca inactivo", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await act(async () => {
      await result.current.setUserActive("u-vendedor", false)
    })

    const fila = falso.datos.usuarios.find((u) => u.id === "u-vendedor")

    expect(fila.activo).toBe(false)
  })

  it("elimina un usuario", async () => {
    const { result } = await renderAuth({
      sesionInicial: { user: { id: "auth-admin" } },
    })

    await act(async () => {
      await result.current.deleteUser("u-invitado")
    })

    expect(
      falso.datos.usuarios.some((u) => u.id === "u-invitado")
    ).toBe(false)
  })
})

/*
  La guarda que evita actualizar el estado de un proveedor ya desmontado
  se cubría por accidente: solo se ejecutaba cuando una prueba cualquiera
  terminaba mientras la sesión seguía en vuelo, lo que pasaba en una de
  cada seis corridas. Eso hacía variar la cobertura de ramas entre
  corridas sin que nadie hubiera decidido probar ese camino.

  Aquí se prueba a propósito: la sesión se resuelve a mano, después del
  desmontaje.
*/
describe("desmontar mientras la sesión está en vuelo", () => {
  it("no actualiza el estado del proveedor ya desmontado", async () => {
    let resolverSesion

    const sesionPendiente = new Promise((resolver) => {
      resolverSesion = resolver
    })

    falso = crearSupabaseFalso({ tablas: DATOS_BASE, cuentas: CUENTAS })
    falso.auth.getSession = vi.fn(() => sesionPendiente)

    globalThis.__supabaseFalso = falso

    const { AuthProvider } = await import("./AuthContext")
    const { useAuth } = await import("../hooks/useAuth")

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.cargando).toBe(true)

    unmount()

    const errores = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      resolverSesion({ data: { session: { user: { id: "auth-admin" } } } })
      await sesionPendiente
    })

    expect(errores).not.toHaveBeenCalled()

    errores.mockRestore()
  })
})

/*
  El mismo caso en el segundo efecto, el que trae la lista de usuarios de
  la empresa. También se cubría por accidente y por eso la cobertura de
  ramas variaba entre corridas.

  Solo se deja en vuelo la consulta de la lista: la del perfil termina con
  maybeSingle y tiene que resolver para que el proveedor llegue a montar.
*/
describe("desmontar mientras la lista de usuarios está en vuelo", () => {
  it("no actualiza la lista de un proveedor ya desmontado", async () => {
    let resolverLista

    // Sin sesión no se pide la lista: el efecto sale antes.
    falso = crearSupabaseFalso({
      tablas: DATOS_BASE,
      cuentas: CUENTAS,
      sesionInicial: { user: { id: "auth-admin" } },
    })

    globalThis.__supabaseFalso = falso

    const consultaOriginal = falso.from

    falso.from = vi.fn((tabla) => {
      const constructor = consultaOriginal(tabla)

      if (tabla !== "usuarios") return constructor

      /*
        Se sobrescribe el terminal en el objeto mismo y no en una copia:
        cada método de la cadena devuelve ese objeto, así que una copia
        quedaría fuera del camino en cuanto se llamara a select o eq.
      */
      constructor.then = (resolver) =>
        new Promise((r) => {
          resolverLista = () => r({ data: [], error: null })
        }).then(resolver)

      return constructor
    })

    const { AuthProvider } = await import("./AuthContext")
    const { useAuth } = await import("../hooks/useAuth")

    const vista = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(vista.result.current.cargando).toBe(false))
    await waitFor(() => expect(resolverLista).toBeDefined())

    vista.unmount()

    const errores = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      resolverLista()
    })

    expect(errores).not.toHaveBeenCalled()

    errores.mockRestore()
  })
})
