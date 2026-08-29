import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { AuthContext } from "./contexts"

import {
  guardarJSON,
  guardarTexto,
  borrar,
} from "../utils/almacenamiento"

import { crearId } from "../utils/ids"
import { hashPassword } from "../utils/password"

import {
  PERMISSIONS,
  ADMIN_PERMISSIONS,
  SELLER_PERMISSIONS,
} from "./permissions"

const USERS_STORAGE_KEY =
  "ferreteria_users"

const SESSION_STORAGE_KEY =
  "ferreteria_session_user_id"

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

      guardarJSON(USERS_STORAGE_KEY, initialUsers)

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

      guardarJSON(USERS_STORAGE_KEY, initialUsers)

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

function readStoredSessionId() {
  try {
    return localStorage.getItem(
      SESSION_STORAGE_KEY
    )
  } catch (error) {
    console.error(
      "Error leyendo la sesión guardada:",
      error
    )

    return null
  }
}

function withoutPasswordHash(user) {
  const publicUser = { ...user }

  delete publicUser.passwordHash

  return publicUser
}

/*
 * Devuelve null si al usuario en sesión
 * lo eliminaron o desactivaron, para que
 * el cambio surta efecto sin esperar a
 * que vuelva a entrar.
 */
function findActiveSessionUser(
  users,
  sessionUserId
) {
  if (!sessionUserId) {
    return null
  }

  const sessionUser = users.find(
    (currentUser) =>
      String(currentUser.id) ===
      String(sessionUserId)
  )

  if (
    !sessionUser ||
    !sessionUser.active
  ) {
    return null
  }

  return normalizeUser(sessionUser)
}

export function AuthProvider({
  children,
}) {
  const [users, setUsers] =
    useState(loadUsers)

  /*
   * El identificador se lee de forma
   * síncrona. Si la sesión se recuperara
   * dentro de un efecto, el primer render
   * vería user = null y las rutas
   * protegidas mandarían al login en cada
   * refresco.
   */
  const [
    sessionUserId,
    setSessionUserId,
  ] = useState(readStoredSessionId)

  /*
   * El usuario se deriva de la lista, no se
   * copia: así quitarle permisos o
   * desactivarlo se refleja de inmediato sin
   * un efecto que sincronice.
   */
  const user = useMemo(
    () =>
      findActiveSessionUser(
        users,
        sessionUserId
      ),
    [users, sessionUserId]
  )

  useEffect(() => {
    guardarJSON(USERS_STORAGE_KEY, users)
  }, [users])

  useEffect(() => {
    if (sessionUserId && !user) {
      borrar(SESSION_STORAGE_KEY)
    }
  }, [sessionUserId, user])

  /*
   * LOGIN
   */
  const login = useCallback((
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

    setSessionUserId(
      String(authenticatedUser.id)
    )

    guardarTexto(SESSION_STORAGE_KEY, String(
        authenticatedUser.id)
    )

    /*
     * Eliminamos la sesión antigua
     * que utilizaba la versión anterior.
     */
    borrar("user")

    return true
  }, [users])

  /*
   * LOGOUT
   */
  const logout = useCallback(() => {
    setSessionUserId(null)

    borrar(SESSION_STORAGE_KEY)

    borrar("user")
  }, [])

  /*
   * COMPROBAR PERMISOS
   */
  const hasPermission = useCallback((
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
  }, [user])

  const addUser = useCallback(({
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
      id: crearId("USR"),

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
  }, [users])

  const updateUser = useCallback((
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
  }, [users])

  const deleteUser = useCallback((
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
  }, [user, users])

  /*
   * ACTIVAR / DESACTIVAR
   */
  const setUserActive = useCallback((
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
  }, [updateUser])

  
  const getUserById = useCallback((
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
  }, [users])

  const publicUsers = useMemo(
    () => users.map(withoutPasswordHash),
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
        login,
        logout,
        hasPermission,
        addUser,
        updateUser,
        deleteUser,
        setUserActive,
        getUserById,
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
