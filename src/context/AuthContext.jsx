import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

const AuthContext = createContext(null)

const USERS_STORAGE_KEY =
  "ferreteria_users"

const SESSION_STORAGE_KEY =
  "ferreteria_session_user_id"

export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  POS: "pos",
  QUOTES: "quotes",
  PRODUCTS: "products",
  CLIENTS: "clients",
  SUPPLIERS: "suppliers",
  SALES_HISTORY: "sales-history",
  SETTINGS: "settings",
}

/*
 * Administrador = acceso total.
 */
export const ADMIN_PERMISSIONS =
  Object.values(PERMISSIONS)

/*
 * Permisos sugeridos para vendedor.
 *
 * Después podremos modificarlos individualmente
 * desde Configuración.
 */
export const SELLER_PERMISSIONS = [
  PERMISSIONS.DASHBOARD,
  PERMISSIONS.POS,
  PERMISSIONS.QUOTES,
  PERMISSIONS.CLIENTS,
  PERMISSIONS.SALES_HISTORY,
]

function hashPassword(value = "") {
  let hash = 0

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      Math.imul(31, hash) +
      value.charCodeAt(index)

    hash |= 0
  }

  return `h${(
    hash >>> 0
  ).toString(36)}`
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID()
  }

  return `USR-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function createBootstrapAdmin() {
  return {
    id: "admin-inicial",

    name: "Administrador",

    username: "admin",

    passwordHash:
      hashPassword("1234"),

    role: "admin",

    active: true,

    permissions:
      ADMIN_PERMISSIONS,

    createdAt:
      new Date().toISOString(),
  }
}

function normalizeUser(user) {
  const role =
    user?.role === "admin"
      ? "admin"
      : "vendedor"

  return {
    ...user,

    name:
      user?.name ||
      user?.displayName ||
      "Usuario",

    username:
      String(
        user?.username || ""
      )
        .trim()
        .toLowerCase(),

    role,

    active:
      user?.active !== false,

    permissions:
      role === "admin"
        ? ADMIN_PERMISSIONS
        : Array.isArray(
              user?.permissions
            )
          ? user.permissions
          : SELLER_PERMISSIONS,
  }
}

function loadUsers() {
  try {
    const saved =
      localStorage.getItem(
        USERS_STORAGE_KEY
      )

    if (!saved) {
      const initialUsers = [
        createBootstrapAdmin(),
      ]

      localStorage.setItem(
        USERS_STORAGE_KEY,
        JSON.stringify(
          initialUsers
        )
      )

      return initialUsers
    }

    const parsed =
      JSON.parse(saved)

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0
    ) {
      const initialUsers = [
        createBootstrapAdmin(),
      ]

      localStorage.setItem(
        USERS_STORAGE_KEY,
        JSON.stringify(
          initialUsers
        )
      )

      return initialUsers
    }

    return parsed.map(
      normalizeUser
    )
  } catch (error) {
    console.error(
      "Error cargando usuarios:",
      error
    )

    return [
      createBootstrapAdmin(),
    ]
  }
}

export function AuthProvider({
  children,
}) {
  const [users, setUsers] =
    useState(loadUsers)

  const [user, setUser] =
    useState(null)

  /*
   * Guarda los usuarios cada vez
   * que haya un cambio.
   */
  useEffect(() => {
    localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify(users)
    )
  }, [users])

  /*
   * Recuperar sesión al recargar
   * el navegador.
   */
  useEffect(() => {
    const sessionUserId =
      localStorage.getItem(
        SESSION_STORAGE_KEY
      )

    if (!sessionUserId) {
      setUser(null)
      return
    }

    const sessionUser =
      users.find(
        (currentUser) =>
          String(
            currentUser.id
          ) ===
          String(
            sessionUserId
          )
      )

    /*
     * Si el usuario fue eliminado
     * o desactivado, se termina
     * automáticamente la sesión.
     */
    if (
      !sessionUser ||
      !sessionUser.active
    ) {
      localStorage.removeItem(
        SESSION_STORAGE_KEY
      )

      setUser(null)

      return
    }

    setUser(
      normalizeUser(
        sessionUser
      )
    )
  }, [users])

  /*
   * LOGIN
   */
  const login = (
    username,
    password
  ) => {
    const normalizedUsername =
      String(username || "")
        .trim()
        .toLowerCase()

    const passwordHash =
      hashPassword(
        String(password || "")
      )

    const foundUser =
      users.find(
        (currentUser) =>
          currentUser.username ===
          normalizedUsername
      )

    if (!foundUser) {
      return false
    }

    if (!foundUser.active) {
      return false
    }

    if (
      foundUser.passwordHash !==
      passwordHash
    ) {
      return false
    }

    const authenticatedUser =
      normalizeUser(
        foundUser
      )

    setUser(
      authenticatedUser
    )

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      String(
        authenticatedUser.id
      )
    )

    /*
     * Eliminamos la sesión antigua
     * que utilizaba la versión anterior.
     */
    localStorage.removeItem(
      "user"
    )

    return true
  }

  /*
   * LOGOUT
   */
  const logout = () => {
    setUser(null)

    localStorage.removeItem(
      SESSION_STORAGE_KEY
    )

    localStorage.removeItem(
      "user"
    )
  }

  /*
   * COMPROBAR PERMISOS
   */
  const hasPermission = (
    permission
  ) => {
    if (!user) {
      return false
    }

    /*
     * Admin siempre tiene
     * acceso completo.
     */
    if (
      user.role === "admin"
    ) {
      return true
    }

    return (
      Array.isArray(
        user.permissions
      ) &&
      user.permissions.includes(
        permission
      )
    )
  }

  const addUser = ({
    name,
    username,
    password,
    role = "vendedor",
    permissions = [],
    active = true,
  }) => {
    const cleanName =
      String(name || "").trim()

    const cleanUsername =
      String(username || "")
        .trim()
        .toLowerCase()

    const cleanPassword =
      String(password || "")

    if (!cleanName) {
      throw new Error(
        "El nombre es obligatorio."
      )
    }

    if (!cleanUsername) {
      throw new Error(
        "El usuario es obligatorio."
      )
    }

    if (
      cleanUsername.length < 3
    ) {
      throw new Error(
        "El usuario debe tener al menos 3 caracteres."
      )
    }

    if (
      cleanPassword.length < 4
    ) {
      throw new Error(
        "La contraseña debe tener al menos 4 caracteres."
      )
    }

    const usernameExists =
      users.some(
        (currentUser) =>
          currentUser.username ===
          cleanUsername
      )

    if (usernameExists) {
      throw new Error(
        "Ese nombre de usuario ya existe."
      )
    }

    const normalizedRole =
      role === "admin"
        ? "admin"
        : "vendedor"

    const newUser = {
      id: createId(),

      name: cleanName,

      username:
        cleanUsername,

      passwordHash:
        hashPassword(
          cleanPassword
        ),

      role:
        normalizedRole,

      active:
        Boolean(active),

      permissions:
        normalizedRole ===
        "admin"
          ? ADMIN_PERMISSIONS
          : Array.from(
              new Set(
                permissions
              )
            ),

      createdAt:
        new Date().toISOString(),
    }

    setUsers(
      (currentUsers) => [
        ...currentUsers,
        newUser,
      ]
    )

    return newUser
  }

  const updateUser = (
    userId,
    changes
  ) => {
    const existingUser =
      users.find(
        (currentUser) =>
          String(
            currentUser.id
          ) ===
          String(userId)
      )

    if (!existingUser) {
      throw new Error(
        "Usuario no encontrado."
      )
    }

    const cleanName =
      String(
        changes.name ??
          existingUser.name
      ).trim()

    const cleanUsername =
      String(
        changes.username ??
          existingUser.username
      )
        .trim()
        .toLowerCase()

    if (!cleanName) {
      throw new Error(
        "El nombre es obligatorio."
      )
    }

    if (!cleanUsername) {
      throw new Error(
        "El usuario es obligatorio."
      )
    }

    const duplicatedUsername =
      users.some(
        (currentUser) =>
          String(
            currentUser.id
          ) !==
            String(userId) &&
          currentUser.username ===
            cleanUsername
      )

    if (
      duplicatedUsername
    ) {
      throw new Error(
        "Ese nombre de usuario ya existe."
      )
    }

    const nextRole =
      changes.role === "admin"
        ? "admin"
        : changes.role ===
            "vendedor"
          ? "vendedor"
          : existingUser.role

    if (
      existingUser.role ===
        "admin" &&
      nextRole !== "admin"
    ) {
      const activeAdmins =
        users.filter(
          (currentUser) =>
            currentUser.role ===
              "admin" &&
            currentUser.active
        )

      if (
        activeAdmins.length <= 1
      ) {
        throw new Error(
          "Debe existir al menos un administrador activo."
        )
      }
    }

    if (
      existingUser.role ===
        "admin" &&
      changes.active ===
        false
    ) {
      const activeAdmins =
        users.filter(
          (currentUser) =>
            currentUser.role ===
              "admin" &&
            currentUser.active
        )

      if (
        activeAdmins.length <= 1
      ) {
        throw new Error(
          "No puedes desactivar al último administrador."
        )
      }
    }

    const updatedUser = {
      ...existingUser,

      ...changes,

      name: cleanName,

      username:
        cleanUsername,

      role:
        nextRole,

      permissions:
        nextRole === "admin"
          ? ADMIN_PERMISSIONS
          : Array.isArray(
                changes.permissions
              )
            ? Array.from(
                new Set(
                  changes.permissions
                )
              )
            : existingUser.permissions,
    }

    if (
      changes.password
    ) {
      if (
        String(
          changes.password
        ).length < 4
      ) {
        throw new Error(
          "La contraseña debe tener al menos 4 caracteres."
        )
      }

      updatedUser.passwordHash =
        hashPassword(
          String(
            changes.password
          )
        )
    }

    delete updatedUser.password

    setUsers(
      (currentUsers) =>
        currentUsers.map(
          (currentUser) =>
            String(
              currentUser.id
            ) ===
            String(userId)
              ? updatedUser
              : currentUser
        )
    )

    return updatedUser
  }

  const deleteUser = (
    userId
  ) => {
    const userToDelete =
      users.find(
        (currentUser) =>
          String(
            currentUser.id
          ) ===
          String(userId)
      )

    if (!userToDelete) {
      throw new Error(
        "Usuario no encontrado."
      )
    }

    if (
      user &&
      String(user.id) ===
        String(userId)
    ) {
      throw new Error(
        "No puedes eliminar tu propio usuario mientras tienes la sesión iniciada."
      )
    }

    if (
      userToDelete.role ===
      "admin"
    ) {
      const activeAdmins =
        users.filter(
          (currentUser) =>
            currentUser.role ===
              "admin" &&
            currentUser.active
        )

      if (
        activeAdmins.length <= 1
      ) {
        throw new Error(
          "No puedes eliminar al último administrador."
        )
      }
    }

    setUsers(
      (currentUsers) =>
        currentUsers.filter(
          (currentUser) =>
            String(
              currentUser.id
            ) !==
            String(userId)
        )
    )

    return true
  }

  /*
   * ACTIVAR / DESACTIVAR
   */
  const setUserActive = (
    userId,
    active
  ) => {
    return updateUser(
      userId,
      {
        active:
          Boolean(active),
      }
    )
  }

  
  const getUserById = (
    userId
  ) => {
    return (
      users.find(
        (currentUser) =>
          String(
            currentUser.id
          ) ===
          String(userId)
      ) || null
    )
  }

  const publicUsers =
    useMemo(
      () =>
        users.map(
          ({
            passwordHash,
            ...publicUser
          }) => publicUser
        ),
      [users]
    )

  const contextValue =
    useMemo(
      () => ({
        user,

        users:
          publicUsers,

        login,

        logout,

        hasPermission,

        addUser,

        updateUser,

        deleteUser,

        setUserActive,

        getUserById,

        permissions:
          PERMISSIONS,

        adminPermissions:
          ADMIN_PERMISSIONS,

        sellerPermissions:
          SELLER_PERMISSIONS,

        isAdmin:
          user?.role ===
          "admin",
      }),
      [
        user,
        publicUsers,
        users,
      ]
    )

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context =
    useContext(AuthContext)

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider."
    )
  }

  return context
}