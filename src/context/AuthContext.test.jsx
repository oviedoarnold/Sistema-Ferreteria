import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { AuthProvider, useAuth, PERMISSIONS } from "./AuthContext"

const renderAuth = () =>
  renderHook(() => useAuth(), { wrapper: AuthProvider })

const ADMIN = { username: "admin", password: "1234" }

const entrarComoAdmin = (result) => {
  act(() => {
    result.current.login(ADMIN.username, ADMIN.password)
  })
}

const crearVendedor = (result, extra = {}) => {
  let creado

  act(() => {
    creado = result.current.addUser({
      name: "María Vendedora",
      username: "maria",
      password: "clave123",
      role: "vendedor",
      permissions: [PERMISSIONS.POS, PERMISSIONS.SALES_HISTORY],
      ...extra,
    })
  })

  return creado
}

describe("AuthProvider: sesión inicial", () => {
  it("arranca sin usuario en sesión", () => {
    const { result } = renderAuth()
    expect(result.current.user).toBeNull()
  })

  it("crea el administrador inicial en el primer arranque", () => {
    const { result } = renderAuth()

    expect(result.current.users).toHaveLength(1)
    expect(result.current.users[0].username).toBe("admin")
  })

  it("nunca expone el hash de la contraseña", () => {
    const { result } = renderAuth()
    expect(result.current.users[0].passwordHash).toBeUndefined()
  })
})

describe("login", () => {
  it("acepta las credenciales correctas", () => {
    const { result } = renderAuth()

    let exito
    act(() => {
      exito = result.current.login(ADMIN.username, ADMIN.password)
    })

    expect(exito).toBe(true)
    expect(result.current.user.username).toBe("admin")
  })

  it("rechaza una contraseña incorrecta", () => {
    const { result } = renderAuth()

    let exito
    act(() => {
      exito = result.current.login("admin", "equivocada")
    })

    expect(exito).toBeFalsy()
    expect(result.current.user).toBeNull()
  })

  it("rechaza un usuario inexistente", () => {
    const { result } = renderAuth()

    let exito
    act(() => {
      exito = result.current.login("fantasma", "1234")
    })

    expect(exito).toBeFalsy()
  })

  it("ignora mayúsculas y espacios en el nombre de usuario", () => {
    const { result } = renderAuth()

    let exito
    act(() => {
      exito = result.current.login("  ADMIN  ", "1234")
    })

    expect(exito).toBe(true)
  })

  it("guarda la sesión para que sobreviva al refresco", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)

    expect(localStorage.getItem("ferreteria_session_user_id")).toBeTruthy()
  })
})

describe("logout", () => {
  it("cierra la sesión y borra el rastro guardado", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem("ferreteria_session_user_id")).toBeNull()
  })
})

describe("hasPermission", () => {
  it("niega todo sin sesión", () => {
    const { result } = renderAuth()
    expect(result.current.hasPermission(PERMISSIONS.POS)).toBe(false)
  })

  it("el administrador tiene acceso a todo", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)

    Object.values(PERMISSIONS).forEach((permiso) => {
      expect(result.current.hasPermission(permiso)).toBe(true)
    })
  })

  it("el vendedor solo tiene lo que se le habilitó", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    crearVendedor(result)

    act(() => {
      result.current.login("maria", "clave123")
    })

    expect(result.current.hasPermission(PERMISSIONS.POS)).toBe(true)
    expect(result.current.hasPermission(PERMISSIONS.SETTINGS)).toBe(false)
    expect(result.current.hasPermission(PERMISSIONS.PRODUCTS)).toBe(false)
  })

  it("isAdmin distingue el rol", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)

    expect(result.current.isAdmin).toBe(true)
  })
})

describe("addUser", () => {
  it("agrega un vendedor a la lista", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    crearVendedor(result)

    expect(result.current.users).toHaveLength(2)
  })

  it("el usuario nuevo puede iniciar sesión con su contraseña", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    crearVendedor(result)

    let exito
    act(() => {
      exito = result.current.login("maria", "clave123")
    })

    expect(exito).toBe(true)
  })

  it("no permite repetir el nombre de usuario", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)

    expect(() => {
      crearVendedor(result, { username: "admin" })
    }).toThrow()
  })
})

describe("updateUser", () => {
  it("cambia los permisos de un vendedor", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.updateUser(vendedor.id, {
        permissions: [PERMISSIONS.CLIENTS],
      })
    })

    act(() => {
      result.current.login("maria", "clave123")
    })

    expect(result.current.hasPermission(PERMISSIONS.CLIENTS)).toBe(true)
    expect(result.current.hasPermission(PERMISSIONS.POS)).toBe(false)
  })

  it("conserva la contraseña si no se envía una nueva", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.updateUser(vendedor.id, { name: "María Editada" })
    })

    let exito
    act(() => {
      exito = result.current.login("maria", "clave123")
    })

    expect(exito).toBe(true)
  })
})

describe("setUserActive", () => {
  it("un usuario desactivado no puede iniciar sesión", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.setUserActive(vendedor.id, false)
    })

    let exito
    act(() => {
      exito = result.current.login("maria", "clave123")
    })

    expect(exito).toBeFalsy()
  })

  it("al reactivarlo vuelve a poder entrar", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.setUserActive(vendedor.id, false)
    })

    act(() => {
      result.current.setUserActive(vendedor.id, true)
    })

    let exito
    act(() => {
      exito = result.current.login("maria", "clave123")
    })

    expect(exito).toBe(true)
  })
})

describe("deleteUser", () => {
  it("quita el usuario de la lista", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.deleteUser(vendedor.id)
    })

    expect(result.current.users).toHaveLength(1)
  })

  it("el usuario eliminado ya no puede entrar", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    act(() => {
      result.current.deleteUser(vendedor.id)
    })

    let exito
    act(() => {
      exito = result.current.login("maria", "clave123")
    })

    expect(exito).toBeFalsy()
  })
})

describe("getUserById", () => {
  it("encuentra al usuario creado", () => {
    const { result } = renderAuth()
    entrarComoAdmin(result)
    const vendedor = crearVendedor(result)

    expect(result.current.getUserById(vendedor.id).username).toBe("maria")
  })

  it("devuelve null si no existe", () => {
    const { result } = renderAuth()
    expect(result.current.getUserById("no-existe")).toBeNull()
  })
})
